// A stand-in for the service-role supabase-js client, over the PGlite
// database, so the edge-function handlers run end to end in the tests:
// the same query-builder calls (from/select/eq/in/order/limit/insert/update/
// upsert/delete/maybeSingle/single, rpc), Supabase Auth's getUser, and a
// private storage bucket kept in memory. Every query runs as service_role,
// like the real functions. Only what the handlers use is implemented; an
// unsupported call throws so a gap is never silently "passing".

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => { if (!IDENT.test(s)) throw new Error(`adapter: bad identifier ${s}`); return `"${s}"`; };

// Values come back the way PostgREST sends them over JSON: dates as text,
// timestamps as ISO strings, bigint and numeric as numbers.
const iso = (v) => new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString();
const PARSERS = { 1082: (v) => v, 1114: iso, 1184: iso, 20: Number, 1700: Number };

export function makeClient(pg, { tokens = new Map() } = {}) {
  const storage = new Map();           // "bucket/path" → { bytes, mimetype }
  const calls = { signedUrls: [], uploads: [], removed: [] };
  const types = new Map();             // table → { column: data_type }

  async function run(sql, params) {
    return pg.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      return tx.query(sql, params, { parsers: PARSERS });
    });
  }
  async function columnTypes(table) {
    if (!types.has(table)) {
      const r = await pg.query("select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1", [table]);
      types.set(table, Object.fromEntries(r.rows.map((x) => [x.column_name, x.data_type])));
    }
    return types.get(table);
  }

  function builder(table) {
    const st = { op: "select", cols: "*", where: [], params: [], order: [], limit: null, single: null, rows: null, patch: null, onConflict: null, returning: false };
    const p = (v) => { st.params.push(v); return `$${st.params.length}`; };
    let colType = {};
    // json columns get JSON text (whatever the value); everything else goes as is
    const valFor = (col, v) => (v != null && /json/.test(colType[col] ?? "") ? JSON.stringify(v) : v);
    const val = (v) => v;
    const cols = (c) => c.trim() === "*" ? "*" : c.split(",").map((x) => ident(x.trim())).join(", ");
    const api = {
      select(c = "*") { if (st.op === "select") st.cols = c; else { st.returning = true; st.cols = c; } return api; },
      insert(rows) { st.op = "insert"; st.rows = Array.isArray(rows) ? rows : [rows]; return api; },
      upsert(rows, opts = {}) { st.op = "insert"; st.rows = Array.isArray(rows) ? rows : [rows]; st.onConflict = opts.onConflict ?? "id"; return api; },
      update(patch) { st.op = "update"; st.patch = patch; return api; },
      delete() { st.op = "delete"; return api; },
      eq(c, v) { st.where.push(`${ident(c)} = ${p(val(v))}`); return api; },
      neq(c, v) { st.where.push(`${ident(c)} is distinct from ${p(val(v))}`); return api; },
      gt(c, v) { st.where.push(`${ident(c)} > ${p(v)}`); return api; },
      gte(c, v) { st.where.push(`${ident(c)} >= ${p(v)}`); return api; },
      lt(c, v) { st.where.push(`${ident(c)} < ${p(v)}`); return api; },
      lte(c, v) { st.where.push(`${ident(c)} <= ${p(v)}`); return api; },
      like(c, v) { st.where.push(`${ident(c)} like ${p(v)}`); return api; },
      in(c, vs) { st.where.push(vs.length ? `${ident(c)} = any(${p(vs)})` : "false"); return api; },
      is(c, v) { if (v !== null) throw new Error("adapter: is() only supports null"); st.where.push(`${ident(c)} is null`); return api; },
      order(c, o = {}) { st.order.push(`${ident(c)} ${o.ascending === false ? "desc" : "asc"}`); return api; },
      limit(n) { st.limit = Number(n); return api; },
      maybeSingle() { st.single = "maybe"; return api; },
      single() { st.single = "one"; return api; },
      then(res, rej) { return exec().then(res, rej); },
    };
    async function exec() {
      colType = await columnTypes(table);
      const where = st.where.length ? ` where ${st.where.join(" and ")}` : "";
      let sql;
      if (st.op === "select") {
        sql = `select ${cols(st.cols)} from ${ident(table)}${where}${st.order.length ? ` order by ${st.order.join(", ")}` : ""}${st.limit != null ? ` limit ${st.limit}` : ""}`;
      } else if (st.op === "insert") {
        const keys = [...new Set(st.rows.flatMap((r) => Object.keys(r)))];
        const values = st.rows.map((r) => `(${keys.map((k) => (k in r ? p(valFor(k, r[k])) : "default")).join(", ")})`).join(", ");
        const conflict = st.onConflict ? ` on conflict (${st.onConflict.split(",").map((x) => ident(x.trim())).join(", ")}) do update set ${keys.filter((k) => !st.onConflict.split(",").map((x) => x.trim()).includes(k)).map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ") || `${ident(keys[0])} = excluded.${ident(keys[0])}`}` : "";
        sql = `insert into ${ident(table)} (${keys.map(ident).join(", ")}) values ${values}${conflict} returning ${st.returning ? cols(st.cols) : "*"}`;
      } else if (st.op === "update") {
        const sets = Object.entries(st.patch).map(([k, v]) => `${ident(k)} = ${p(valFor(k, v))}`).join(", ");
        sql = `update ${ident(table)} set ${sets}${where} returning ${st.returning ? cols(st.cols) : "*"}`;
      } else if (st.op === "delete") {
        sql = `delete from ${ident(table)}${where} returning *`;
      }
      try {
        const r = await run(sql, st.params);
        let data = r.rows;
        if (st.op !== "select" && !st.returning) data = null;
        if (st.single === "maybe") {
          if (data && data.length > 1) return { data: null, error: { message: "more than one row" } };
          data = data ? data[0] ?? null : null;
        } else if (st.single === "one") {
          if (!data || data.length !== 1) return { data: null, error: { message: `expected one row, got ${data?.length ?? 0}` } };
          data = data[0];
        }
        return { data, error: null };
      } catch (e) {
        return { data: null, error: { message: String(e.message), code: e.code } };
      }
    }
    return api;
  }

  const client = {
    from: (t) => builder(t),
    async rpc(fn, args = {}) {
      const keys = Object.keys(args);
      const sql = `select * from ${ident(fn)}(${keys.map((k, i) => `${ident(k).replace(/"/g, "")} => $${i + 1}`).join(", ")})`;
      try {
        const r = await run(sql, keys.map((k) => args[k]));
        const row = r.rows[0];
        // scalar functions come back as { fn_name: value }
        if (r.fields?.length === 1 && r.fields[0].name === fn) return { data: row ? row[fn] : null, error: null };
        return { data: r.rows, error: null };
      } catch (e) { return { data: null, error: { message: String(e.message) } }; }
    },
    auth: {
      async getUser(jwt) {
        const u = tokens.get(jwt);
        return u ? { data: { user: { id: u.sub, email: u.email } }, error: null } : { data: { user: null }, error: { message: "invalid token" } };
      },
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrls(paths, seconds) {
            calls.signedUrls.push({ bucket, paths, seconds });
            return { data: paths.map((path) => ({ path, signedUrl: `https://storage.test/sign/${bucket}/${path}?exp=${seconds}` })), error: null };
          },
          async createSignedUploadUrl(path) {
            calls.uploads.push({ bucket, path });
            return { data: { signedUrl: `https://storage.test/upload/${bucket}/${path}?token=t`, token: "t", path }, error: null };
          },
          async list(dir, { search } = {}) {
            const out = [];
            for (const [k, v] of storage) {
              if (!k.startsWith(`${bucket}/${dir}/`)) continue;
              const name = k.slice(bucket.length + dir.length + 2);
              if (name.includes("/") || (search && !name.includes(search))) continue;
              out.push({ name, metadata: { size: v.bytes.length, mimetype: v.mimetype } });
            }
            return { data: out, error: null };
          },
          async upload(path, bytes, { contentType } = {}) { storage.set(`${bucket}/${path}`, { bytes, mimetype: contentType }); return { data: { path }, error: null }; },
          async remove(paths) { for (const x of paths) { storage.delete(`${bucket}/${x}`); calls.removed.push(x); } return { data: paths, error: null }; },
        };
      },
    },
  };
  return { client, storage, calls };
}

/* Tokens: header.payload.sig like a real JWT, so the handlers can read aal. */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function issueToken(tokens, { sub, email, aal = "aal1" }) {
  const t = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, email, aal, role: "authenticated" })}.sig-${tokens.size}`;
  tokens.set(t, { sub, email, aal });
  return t;
}

/** A Request as the browser would send it. */
export function post(url, token, body, headers = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
}
