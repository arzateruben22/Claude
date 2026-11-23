#!/usr/bin/env python3
"""Draft Vice Unfiltered titles and captions with ChatGPT (OpenAI API), then check them.

Usage: python3 -I tools/titles.py <job.json> [--model MODEL]     (run from vice-unfiltered/)

The job holds ONLY facts verified from the footage; the model is told to invent
nothing. Output goes to <job dir>/TITLES.json and is printed. Every option still
gets a human truth check against the clip before it is delivered.

Job JSON:
{
  "streamer": "Dom", "handle": "Dasgasd3m", "game": "GTA 6",      # game: null if not confirmed
  "facts": ["His pickup truck is on fire and he keeps driving it", "..."],
  "quotes": ["exact line verified from the audio"],                 # optional
  "hook": "STILL DRIVING", "thumbnail_headline": "STILL DRIVING",   # optional context
  "campaign": {"cta": "...", "hashtags": "#A #B", "disclosure": "#ad"},   # optional; copied verbatim
  "n": 5
}
The API key is injected by the session's network proxy; no key is stored here.
"""
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request

API = "https://api.openai.com/v1"
PREFERRED = ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4o"]
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿\U0001F1E6-\U0001F1FF]")

SYSTEM = """You write titles and captions for VICE UNFILTERED, a high-energy short-form clipping channel (YouTube Shorts, TikTok, Instagram Reels) covering streamers' funniest and most chaotic moments.

HARD RULES
- Clickbait but TRUE. Every claim must be supported by the FACTS given. Never invent events, outcomes, numbers, quotes, reactions or context. If a detail is not in the facts, leave it out or stay vague-but-true.
- Never put words in the streamer's mouth. Only use quotes listed under QUOTES, exactly as written.
- Do not name the game unless GAME is given.
- No slurs, nothing targeting protected groups, nothing sexual about real people, no fake "official"/"leaked" claims.
- If CAMPAIGN fields are given, copy the CTA, hashtags and disclosure EXACTLY, character for character, into every caption.

STYLE
- Use emojis generously: 2 to 4 per title, placed for punch (for example 💀 😭 🔥 🚨 😳 🤯 😂 🫠 🧯 📱). Captions can use more.
- Titles: 35 to 80 characters, curiosity gap, punchy, slang where it fits (bro, cooked, no way, crashed out). Use the streamer's exact name in at least half of the titles.
- Vary the angles: reaction-led, situation-led, payoff-led, question, deadpan.
- Do not end every title with ?! ; mix punctuation.

OUTPUT (JSON only)
{"titles": [N strings], "favorite_index": int, "why": "one sentence on why that one wins",
 "captions": {"youtube": "...", "tiktok": "...", "instagram": "..."}}
Caption rules: include the streamer's exact name. YouTube: a hook line + 2 to 3 hashtags including #Shorts. TikTok: a short hook line + 3 to 5 hashtags. Instagram: a hook line, one more line of context, then hashtags."""


def call(path, payload=None, method="GET"):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer sk-injected-by-proxy"})
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            msg = json.loads(body)["error"]["message"]
        except Exception:
            msg = body[:300]
        if e.code == 401:
            msg = "OpenAI rejected the saved API key (401). Replace it with a valid key from platform.openai.com."
        sys.exit(f"OpenAI error {e.code}: {msg}")


def pick_model():
    ids = {m["id"] for m in call("/models").get("data", [])}
    for p in PREFERRED:
        if p in ids:
            return p
    for p in PREFERRED:
        hits = sorted(i for i in ids if i.startswith(p) and not any(x in i for x in ("audio", "realtime", "search", "transcribe", "tts", "image")))
        if hits:
            return hits[0]
    sys.exit("No suitable chat model found on this OpenAI account.")


def check(job, out):
    """Mechanical checks; the truth check against the footage is still done by a person."""
    issues = []
    camp = job.get("campaign") or {}
    for i, t in enumerate(out.get("titles", [])):
        n = len(EMOJI.findall(t))
        if not 2 <= n <= 5:
            issues.append(f"title {i + 1}: {n} emojis")
        if not 25 <= len(t) <= 100:
            issues.append(f"title {i + 1}: {len(t)} characters")
        for q in re.findall(r'"([^"]+)"', t):
            if q not in job.get("quotes", []):
                issues.append(f'title {i + 1}: quote not verified: "{q}"')
        if not job.get("game") and re.search(r"\bGTA\b|grand theft", t, re.I):
            issues.append(f"title {i + 1}: names a game that isn't confirmed")
    for plat, cap in (out.get("captions") or {}).items():
        if job["streamer"].lower() not in cap.lower():
            issues.append(f"{plat} caption: streamer name missing")
        for k in ("cta", "disclosure"):
            if camp.get(k) and camp[k] not in cap:
                issues.append(f"{plat} caption: campaign {k} not copied exactly")
        for tag in (camp.get("hashtags") or "").split():
            if tag not in cap:
                issues.append(f"{plat} caption: required hashtag {tag} missing")
    return issues


def main():
    jp = sys.argv[1]
    job = json.load(open(jp))
    model = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else pick_model()
    n = int(job.get("n", 5))
    user = "\n".join([
        f"STREAMER: {job['streamer']}" + (f" (handle {job['handle']})" if job.get("handle") else ""),
        f"GAME: {job['game']}" if job.get("game") else "GAME: (not confirmed; do not name one)",
        "FACTS:", *[f"- {f}" for f in job["facts"]],
        "QUOTES:", *([f'- "{q}"' for q in job.get("quotes", [])] or ["- (none verified)"]),
        f"HOOK ON SCREEN: {job['hook']}" if job.get("hook") else "",
        f"THUMBNAIL HEADLINE: {job['thumbnail_headline']}" if job.get("thumbnail_headline") else "",
        "CAMPAIGN: " + json.dumps(job["campaign"], ensure_ascii=False) if job.get("campaign") else "CAMPAIGN: none",
        f"N = {n}",
    ])
    res = call("/chat/completions", {"model": model, "response_format": {"type": "json_object"},
                                     "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]}, "POST")
    out = json.loads(res["choices"][0]["message"]["content"])
    out["model"] = model
    out["checks"] = check(job, out)
    dest = os.path.join(os.path.dirname(os.path.abspath(jp)), "TITLES.json")
    json.dump(out, open(dest, "w"), ensure_ascii=False, indent=2)
    print(f"model: {model}")
    for i, t in enumerate(out.get("titles", [])):
        print(f"{'*' if i == out.get('favorite_index') else ' '} {i + 1}. {t}")
    print("why:", out.get("why", ""))
    for k, v in (out.get("captions") or {}).items():
        print(f"\n[{k}]\n{v}")
    print("\nchecks:", "; ".join(out["checks"]) or "none flagged")
    print(f"saved: {dest}")


if __name__ == "__main__":
    main()
