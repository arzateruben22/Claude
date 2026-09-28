"""Put the Lumevina Studio catalog on Etsy as draft listings, with photos and download files.

Python 3 standard library only. Run from the lumevina/pro folder.

  1. Create an app at etsy.com/developers (Your apps, Create a new app). Add this callback URL:
         http://localhost:3003/callback
     Then, in this terminal:
         export ETSY_API_KEY=your_keystring
         export ETSY_SHARED_SECRET=your_shared_secret
  2. python3 etsy/upload.py login          sign in to Etsy in the browser that opens
  3. python3 etsy/upload.py check          your shop, sections and the category each listing will use
  4. python3 etsy/upload.py push --dry-run what would be created, without touching Etsy
     python3 etsy/upload.py push           create drafts (or update ones it made before), then photos and files
  5. Review the drafts in Shop Manager, then publish there (each listing costs $0.20), or:
     python3 etsy/upload.py activate 01 02 ...

Everything it creates starts as a draft. It remembers what it made in etsy/state.json, so running
push again updates those drafts instead of making copies. Your sign-in is kept in etsy/.token.json;
both files stay on your computer (they're in .gitignore).
"""
import base64, hashlib, json, mimetypes, os, secrets, sys, threading, time, urllib.error, urllib.parse, \
    urllib.request, uuid, webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.normpath(os.path.join(HERE, "..", "dist"))
CATALOG = os.path.join(DIST, "etsy", "listings.json")
TOKEN = os.path.join(HERE, ".token.json")
STATE = os.path.join(HERE, "state.json")
CONFIG = os.path.join(HERE, "config.json")        # optional: {"taxonomy": {"01": 1234, ...}}
API = "https://openapi.etsy.com/v3/application"
AUTH_URL = "https://www.etsy.com/oauth/connect"
TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"
REDIRECT = os.environ.get("ETSY_REDIRECT", "http://localhost:3003/callback")
SCOPES = "listings_r listings_w shops_r shops_w"
# Etsy's words for when an item was made. A digital download is made to order; if Etsy
# refuses that, the most recent date range is tried instead.
WHEN_MADE = ["made_to_order", "2020_2026", "2020_2025", "2020_2024"]
# Where each listing goes in Etsy's category tree, best match first (checked against Etsy's live tree).
TAXONOMY_HINTS = {
    "default": [["Paper & Party Supplies", "Paper", "Stationery", "Design & Templates", "Templates"],
                ["Design & Templates", "Templates"], ["Templates"]],
    "09": [["Paper & Party Supplies", "Paper", "Calendars & Planners"], ["Planners"], ["Calendars & Planners"]],
    "08": [["Paper & Party Supplies", "Paper", "Calendars & Planners"], ["Planners"], ["Templates"]],
}


# ───────────────────────────── small helpers ─────────────────────────────

def load(path, default=None):
    try:
        return json.load(open(path))
    except (OSError, ValueError):
        return default


def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def key_header():
    key = os.environ.get("ETSY_API_KEY")
    if not key:
        sys.exit("Set ETSY_API_KEY to your app's keystring first (see the top of this file).")
    secret = os.environ.get("ETSY_SHARED_SECRET")
    # Etsy asks for "keystring:shared_secret" in this header; older apps accepted the keystring alone.
    return "%s:%s" % (key, secret) if secret else key


def token():
    t = load(TOKEN)
    if not t:
        sys.exit("Not signed in. Run: python3 etsy/upload.py login")
    if t.get("expires_at", 0) < time.time() + 60:
        t = refresh(t)
    return t


def refresh(t):
    data = urllib.parse.urlencode({"grant_type": "refresh_token", "client_id": os.environ.get("ETSY_API_KEY", ""),
                                   "refresh_token": t["refresh_token"]}).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        new = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit("Couldn't refresh your sign-in (%s). Run login again." % e.read().decode()[:300])
    t.update(access_token=new["access_token"], refresh_token=new["refresh_token"],
             expires_at=time.time() + new.get("expires_in", 3600))
    save(TOKEN, t)
    return t


def call(method, path, form=None, files=None, query=None, auth=True, quiet=False):
    """One Etsy API call. form: dict of fields; files: {field: path}. Returns parsed JSON."""
    url = API + path + ("?" + urllib.parse.urlencode(query, doseq=True) if query else "")
    headers = {"x-api-key": key_header(), "Accept": "application/json"}
    if auth:
        headers["Authorization"] = "Bearer " + token()["access_token"]
    body = None
    if files:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in (form or {}).items():
            parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (boundary, k, v)).encode())
        for k, p in files.items():
            mime = mimetypes.guess_type(p)[0] or "application/octet-stream"
            parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"
                          % (boundary, k, os.path.basename(p).replace('"', ""), mime)).encode())
            parts.append(open(p, "rb").read())
            parts.append(b"\r\n")
        parts.append(("--%s--\r\n" % boundary).encode())
        body = b"".join(parts)
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    elif form is not None:
        body = urllib.parse.urlencode(form, doseq=True).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
                time.sleep(0.15)                           # stay well under Etsy's rate limit
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code == 429 and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            if not quiet:
                print("  Etsy said %d on %s %s: %s" % (e.code, method, path, msg[:400]))
            raise EtsyError(e.code, msg)
        except urllib.error.URLError as e:
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            sys.exit("Can't reach Etsy: %s" % e)


class EtsyError(Exception):
    def __init__(self, code, msg):
        super().__init__("%d %s" % (code, msg))
        self.code, self.msg = code, msg


# ───────────────────────────── sign in ─────────────────────────────

def login():
    key_header()
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "response_type": "code", "redirect_uri": REDIRECT, "scope": SCOPES, "client_id": os.environ["ETSY_API_KEY"],
        "state": state, "code_challenge": challenge, "code_challenge_method": "S256"})
    got = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            got.update({k: v[0] for k, v in q.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2 style='font-family:sans-serif'>Signed in. You can close this tab.</h2>".encode())

        def log_message(self, *a):
            pass

    port = urllib.parse.urlparse(REDIRECT).port or 3003
    srv = HTTPServer(("localhost", port), Handler)
    threading.Thread(target=srv.handle_request, daemon=True).start()
    print("Opening Etsy to sign in. If nothing opens, paste this into your browser:\n\n  %s\n" % url)
    webbrowser.open(url)
    for _ in range(600):
        if got:
            break
        time.sleep(0.5)
    srv.server_close()
    if got.get("state") != state or "code" not in got:
        sys.exit("Sign-in didn't finish: %s" % (got.get("error_description") or got.get("error") or "no reply"))
    data = urllib.parse.urlencode({"grant_type": "authorization_code", "client_id": os.environ["ETSY_API_KEY"],
                                   "redirect_uri": REDIRECT, "code": got["code"], "code_verifier": verifier}).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        t = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit("Etsy refused the sign-in: %s" % e.read().decode()[:400])
    t["expires_at"] = time.time() + t.get("expires_in", 3600)
    t["user_id"] = t["access_token"].split(".")[0]
    save(TOKEN, t)
    shop = find_shop()
    print("Signed in. Shop: %s (id %s)" % (shop.get("shop_name"), shop.get("shop_id")))


def find_shop():
    t = token()
    if t.get("shop_id"):
        return {"shop_id": t["shop_id"], "shop_name": t.get("shop_name")}
    try:
        me = call("GET", "/users/me")
        shop_id = me.get("shop_id")
    except EtsyError:
        shop_id = None
    if not shop_id:
        res = call("GET", "/users/%s/shops" % t["user_id"])
        shop_id = res.get("shop_id") or (res.get("results") or [{}])[0].get("shop_id")
    if not shop_id:
        sys.exit("This Etsy account doesn't have a shop yet. Open one at etsy.com/sell, then run login again.")
    shop = call("GET", "/shops/%s" % shop_id)
    t.update(shop_id=shop_id, shop_name=shop.get("shop_name"))
    save(TOKEN, t)
    return shop


# ───────────────────────────── catalog pieces ─────────────────────────────

def catalog():
    c = load(CATALOG)
    if not c:
        sys.exit("No catalog at %s. Run: python3 build.py" % CATALOG)
    return c


_tree = None


def taxonomy_tree():
    global _tree
    if _tree is None:
        res = call("GET", "/seller-taxonomy/nodes", auth=False)
        flat = []

        def walk(nodes, trail):
            for n in nodes:
                path = trail + [n["name"]]
                flat.append((n["id"], path))
                walk(n.get("children") or [], path)
        walk(res.get("results", []), [])
        _tree = flat
    return _tree


def taxonomy_for(key):
    cfg = load(CONFIG, {}) or {}
    if str(key) in cfg.get("taxonomy", {}):
        return int(cfg["taxonomy"][str(key)])
    if os.environ.get("ETSY_TAXONOMY_ID"):
        return int(os.environ["ETSY_TAXONOMY_ID"])
    tree = taxonomy_tree()
    for hint in TAXONOMY_HINTS.get(key, []) + TAXONOMY_HINTS["default"]:
        want = [h.lower() for h in hint]
        for node_id, path in tree:
            low = [p.lower() for p in path]
            if low[-len(want):] == want:
                return node_id
    sys.exit("Couldn't find an Etsy category for listing %s. Run `python3 etsy/upload.py taxonomy template`, pick "
             "an id, and save it in etsy/config.json as {\"taxonomy\": {\"%s\": ID}}." % (key, key))


def sections(shop_id, names, create=True):
    have = {s["title"]: s["shop_section_id"] for s in call("GET", "/shops/%s/sections" % shop_id).get("results", [])}
    for n in names:
        if n not in have and create:
            res = call("POST", "/shops/%s/sections" % shop_id, form={"title": n})
            have[n] = res["shop_section_id"]
            print("  made section: %s" % n)
    return have


# ───────────────────────────── commands ─────────────────────────────

def cmd_check():
    c = catalog()
    shop = find_shop()
    print("Shop: %s (id %s)" % (shop.get("shop_name"), shop.get("shop_id")))
    have = sections(shop["shop_id"], c["sections"], create=False)
    for s in c["sections"]:
        print("  section %-24s %s" % (s, "ready" if s in have else "will be made on push"))
    tree = dict(taxonomy_tree())
    for l in c["listings"]:
        tid = taxonomy_for(l["key"])
        print("  %s  %-44s  %s" % (l["key"], l["name"][:44], " > ".join(tree.get(tid, ["?"]))))


def cmd_taxonomy(words):
    words = [w.lower() for w in words] or ["template"]
    for node_id, path in taxonomy_tree():
        text = " > ".join(path)
        if all(w in text.lower() for w in words):
            print("%8d  %s" % (node_id, text))


def listing_form(l, section_id, taxonomy_id, when):
    return {"quantity": l.get("quantity", 999), "title": l["title"], "description": l["description"],
            "price": "%.2f" % l["price"], "who_made": l["who_made"], "when_made": when, "taxonomy_id": taxonomy_id,
            "type": "download", "is_supply": "false", "should_auto_renew": "true",
            "tags": ",".join(l["tags"]), "shop_section_id": section_id}


def cmd_push(keys, dry):
    c = catalog()
    todo = [l for l in c["listings"] if not keys or l["key"] in keys]
    for l in todo:
        for p in l["files"] + l["images"]:
            full = os.path.join(DIST, p)
            if not os.path.exists(full):
                sys.exit("Missing %s. Run: python3 build.py" % full)
    if dry:
        for l in todo:
            print("\n%s  %s  $%.2f  [%s]" % (l["key"], l["title"], l["price"], l["section"]))
            print("    tags: %s" % ", ".join(l["tags"]))
            for p in l["images"]:
                print("    photo  %s" % os.path.basename(p))
            for p in l["files"]:
                print("    file   %-60s %.1f MB" % (os.path.basename(p), os.path.getsize(os.path.join(DIST, p)) / 1e6))
        print("\nDry run: nothing was sent to Etsy.")
        return
    shop = find_shop()
    sid = shop["shop_id"]
    secs = sections(sid, c["sections"])
    state = load(STATE, {}) or {}
    for l in todo:
        st = state.setdefault(l["key"], {})
        tax = taxonomy_for(l["key"])
        print("\n%s  %s" % (l["key"], l["name"]))
        if st.get("listing_id"):
            lid = st["listing_id"]
            form = listing_form(l, secs[l["section"]], tax, st.get("when_made", WHEN_MADE[0]))
            for k in ("quantity", "type", "who_made", "when_made"):
                form.pop(k, None)
            call("PATCH", "/shops/%s/listings/%s" % (sid, lid), form=form)
            print("  updated draft %s" % lid)
        else:
            res = None
            for when in WHEN_MADE:
                try:
                    res = call("POST", "/shops/%s/listings" % sid, form=listing_form(l, secs[l["section"]], tax, when),
                               quiet=True)
                    st["when_made"] = when
                    break
                except EtsyError as e:
                    if "when_made" in e.msg:
                        continue
                    print("  Etsy said: %s" % e.msg[:500])
                    raise SystemExit(1)
            if not res:
                sys.exit("Etsy refused every 'when made' value. Set it in the draft by hand.")
            lid = st["listing_id"] = res["listing_id"]
            save(STATE, state)
            print("  made draft %s" % lid)
        # photos, in order, once each
        done = st.setdefault("images", {})
        for rank, p in enumerate(l["images"], 1):
            if done.get(p):
                continue
            res = call("POST", "/shops/%s/listings/%s/images" % (sid, lid), form={"rank": rank},
                       files={"image": os.path.join(DIST, p)})
            done[p] = res.get("listing_image_id", True)
            save(STATE, state)
            print("  photo %d uploaded" % rank)
        # download files, Start Here first
        fdone = st.setdefault("files", {})
        for rank, p in enumerate(l["files"], 1):
            if fdone.get(p):
                continue
            name = os.path.basename(p)
            res = call("POST", "/shops/%s/listings/%s/files" % (sid, lid), form={"name": name, "rank": rank},
                       files={"file": os.path.join(DIST, p)})
            fdone[p] = res.get("listing_file_id", True)
            save(STATE, state)
            print("  file uploaded: %s" % name)
    print("\nDone. Your drafts are in Shop Manager, Listings, Drafts. Check each one, then publish.")


def cmd_activate(keys):
    state = load(STATE, {}) or {}
    shop = find_shop()
    for k in keys:
        lid = state.get(k, {}).get("listing_id")
        if not lid:
            print("%s: no draft yet (run push first)" % k)
            continue
        call("PATCH", "/shops/%s/listings/%s" % (shop["shop_id"], lid), form={"state": "active"})
        print("%s: published (listing %s)" % (k, lid))


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    cmd, rest = args[0], args[1:]
    flags = [a for a in rest if a.startswith("--")]
    rest = [a for a in rest if not a.startswith("--")]
    if cmd == "login":
        login()
    elif cmd == "check":
        cmd_check()
    elif cmd == "taxonomy":
        cmd_taxonomy(rest)
    elif cmd == "push":
        cmd_push(rest, "--dry-run" in flags)
    elif cmd == "activate":
        if not rest:
            sys.exit("Name the listings to publish, like: activate 01 02 03")
        cmd_activate(rest)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
