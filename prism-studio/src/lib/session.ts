// The owner's session cookie: an HMAC-signed payload. Web Crypto only (no Node APIs), so it runs in the proxy too.
export const COOKIE = "prism_session";
const DAYS = 30;   // the home-screen app reopens signed in for a month
const enc = new TextEncoder(), dec = new TextDecoder();

const b64u = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmac(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

export async function makeSession(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const payload = b64u(enc.encode(JSON.stringify({ sub: "owner", iat: now, exp: now + DAYS * 86_400_000 })));
  return { value: `${payload}.${await hmac(payload)}`, maxAge: DAYS * 86_400 };
}

export async function verifySession(value: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const want = await hmac(payload);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return false;
  try {
    const p = JSON.parse(dec.decode(unb64u(payload)));
    return p.sub === "owner" && typeof p.exp === "number" && p.exp > now;
  } catch { return false; }
}
