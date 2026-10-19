// Reads the screenshots Evelyn added to her playbook, so the assistant can learn from them.
//
//   node knowledge/scripts/read-screenshots.mjs <folder-of-json> <folder-of-images>    (from lumevina/)
//
// <folder-of-json>    the saved playbook sections, as for import-playbook.mjs
// <folder-of-images>  the screenshot files, named by asset id: <id>.png, .jpg, .webp, .gif or .pdf.
//                     Download each with the Artifact tool: read, url = the playbook, path = the asset id.
//
// Writes knowledge/screenshots/<id>.md: what the screenshot says, in her words, with
// clients' names, numbers and photos left out. A screenshot with nothing of hers in it
// is marked "keep: no" and left out of the knowledge. Files already written are kept:
// delete one to read it again. Read each before building the bundle.
//
// Needs ANTHROPIC_API_KEY and the SDK (npm i @anthropic-ai/sdk, in a scratch folder is
// fine: NODE_PATH=<it>/node_modules). Without a key it lists what still needs reading;
// Claude, in a session, can read the images itself and write the same files.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as S from "./playbook-spec.mjs";
import { allShots, itemTitle, SHOTS_DIR, ROOT } from "./playbook-data.mjs";

const [dir, images] = process.argv.slice(2);
if (!dir || !images) { console.error("usage: node knowledge/scripts/read-screenshots.mjs <folder with the playbook JSON files> <folder with the screenshots>"); process.exit(1); }

const MODEL = "claude-opus-5-5";
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" };
const today = new Date().toISOString().slice(0, 10);

const SYSTEM = `You transcribe screenshots that Evelyn Romero, the esthetician who owns Lumevina Aesthetics Spa, added to her Skin Playbook, so the spa website's assistant can answer clients the way she does.

Write out every word Evelyn wrote, exactly as she wrote it: her replies, card text, captions, product directions. Keep her spelling, line breaks and lists. When the screenshot is a conversation, label each message "Evelyn:" or "Client:", and keep the client's messages only as far as needed to understand her answer.

Leave out anything that identifies a client: names, phone numbers, emails, usernames, addresses, visit dates, and any description of photos of a person or their skin. Write [client] in place of a name.

Add nothing of your own: no advice, no explanation, no summary. Write [unreadable] for any part you can't read. If the screenshot holds nothing Evelyn wrote about her work, reply with exactly: NOTHING TO KEEP

Otherwise start with one line, "What it is: " and a few words (for example "a text conversation with a client" or "her aftercare card for peels"). If it clearly answers one of the client questions you're given, add a line "Answers: " with that question. Then a blank line, then the transcription.`;

// where each screenshot was added, for context
const context = (s) => {
  const sec = S.SECTIONS.find((x) => x.id === s.sid);
  let c = `Evelyn added this to the "${itemTitle(s.sid, s.item)}" card in the "${sec ? sec.title : s.sid}" section of her playbook.`;
  const g = S.CLIENT_QUESTION_GROUPS.find((x) => x.id === s.item);
  if (s.sid === "client-questions" && g) c += "\n\nThe client questions on that card:\n" + g.questions.map((q) => "- " + q.q).join("\n");
  return c;
};

const shots = allShots(dir);
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const todo = shots.filter((s) => !fs.existsSync(path.join(SHOTS_DIR, s.id + ".md")));
if (!todo.length) { console.log(`all ${shots.length} screenshots are read. Next: node knowledge/scripts/import-playbook.mjs ${dir}`); process.exit(0); }

const fileFor = (id) => {
  for (const ext of Object.keys(TYPES)) { const f = path.join(images, id + ext); if (fs.existsSync(f)) return { f, type: TYPES[ext] }; }
  return null;
};

if (!process.env.ANTHROPIC_API_KEY) {
  console.log(`${todo.length} of ${shots.length} screenshots still need reading (no ANTHROPIC_API_KEY here):`);
  for (const s of todo) console.log(`  ${s.id}  ${s.sid} / ${s.item}  "${s.name}"${fileFor(s.id) ? "" : "  (not downloaded yet)"}`);
  console.log(`Each becomes knowledge/screenshots/<id>.md: front matter (id, section, item, name, read, keep) and the transcription.`);
  process.exit(0);
}

let Anthropic;
try { Anthropic = createRequire(path.join(ROOT, "package.json"))("@anthropic-ai/sdk"); }
catch { console.error("The Anthropic SDK isn't installed: npm i @anthropic-ai/sdk (or set NODE_PATH to a folder that has it)."); process.exit(1); }
const client = new (Anthropic.default || Anthropic)();

let read = 0, missing = 0;
for (const s of todo) {
  const src = fileFor(s.id);
  if (!src) { missing++; console.log("not downloaded:", s.id, `"${s.name}"`); continue; }
  const data = fs.readFileSync(src.f);
  if (data.length > 5 * 1024 * 1024) { console.log("over 5 MB, skipped:", s.id, `"${s.name}"`); continue; }
  const source = { type: "base64", media_type: src.type, data: data.toString("base64") };
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: [
      src.type === "application/pdf" ? { type: "document", source } : { type: "image", source },
      { type: "text", text: context(s) }
    ] }]
  });
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const keep = text && text !== "NOTHING TO KEEP";
  const front = { id: s.id, section: s.sid, item: s.item, name: JSON.stringify(s.name), read: today, keep: keep ? "yes" : "no" };
  fs.writeFileSync(path.join(SHOTS_DIR, s.id + ".md"),
    "---\n" + Object.entries(front).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n---\n\n" + (keep ? text : "_(nothing of Evelyn's to keep)_") + "\n");
  read++;
  console.log(keep ? "read:" : "nothing to keep:", s.id, `"${s.name}"`);
}
console.log(`read ${read} screenshot${read === 1 ? "" : "s"}${missing ? `, ${missing} not downloaded yet` : ""}. Check them in knowledge/screenshots/, then: node knowledge/scripts/import-playbook.mjs ${dir}`);
