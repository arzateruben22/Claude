# Knowledge: what Ask Lumevina answers from

Everything the website's assistant may say lives here, in Evelyn's words, plus the studio's own facts. The assistant answers only from this folder, the FAQ and policies on the homepage, and her product catalog. Anything else goes to her.

## Where answers come from

1. **Evelyn's Skin Playbook** (the questionnaire): https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ. She fills it in over several sittings; it saves per section. The questions are in `PLAYBOOK-QUESTIONS.md`, generated from `scripts/playbook-spec.mjs`. It opens on **Questions clients ask**: 31 real texts clients send her ("When can I wear makeup again?", "Should I shave before my wax?"), each answered once in her words, so the assistant can answer them without her. Then skin concerns, each treatment explained (steps, feel, downtime, how often, who it's for), aftercare, visits, her routine, products, her own materials, hard lines and her voice.
   **Talk it through** (the first tab): Claude interviews her instead, one question at a time, with a follow-up when an answer is too vague for a client to act on, and saves what she says into the same answers (lightly cleaned, in her words; it never suggests answers or gives advice). She types, dictates with the keyboard's mic key, or uses the mic button where her browser allows; Claude's questions can be read aloud. Each saved answer shows as a chip she can tap to check or edit in its tab. It runs on her own Claude account (the page's `sample` capability); the conversation is kept in the `playbook/interview` document as a record, and its answers are already in the section documents, so the import below needs nothing extra.
2. **Screenshots count as answers.** Every card has **Add screenshots**: old texts to clients, aftercare cards, product guides, Instagram posts, as images or PDFs (an iPhone photo the store can't take is converted to JPEG on her phone). They're kept in the questionnaire's asset store, listed in that card's answers. To read them, download each with the Artifact tool (read, `path` = the asset id) into a folder named by id, then:
   ```sh
   node knowledge/scripts/read-screenshots.mjs <answers folder> <screenshots folder>
   ```
   With `ANTHROPIC_API_KEY` set it transcribes each one into `screenshots/<id>.md`: her words exactly, clients' names, numbers and photos left out, and "keep: no" for anything with nothing of hers in it. Without a key it lists what still needs reading; Claude in a session can read them and write the same files. **Read every transcript before the next step**: it goes into what the assistant says.
3. **Her answers become files here.** Export the questionnaire's saved sections (the `playbook` collection: one JSON file per section, named by section id: `client-questions.json`, `concerns.json`, `treatments.json`, `aftercare.json`, `visits.json`, `routine.json`, `products.json`, `materials.json`, `hard-lines.json`, `voice.json`) into a folder, then:
   ```sh
   node knowledge/scripts/import-playbook.mjs <that folder>      # from lumevina/
   ```
   That writes `client-questions/*.md`, `concerns/*.md`, `treatments/explained/*.md`, `treatments/*.md`, `products/*.md`, `visits.md`, `routine.md`, `materials.md`, `hard-lines.md` and `voice.md`, each dated in `answered:`, with what her screenshots say under "From her screenshots" on the card she added them to. A skipped question keeps "_(not answered yet)_", and the assistant hands those to her.
4. **The bundle the server reads** is generated from these files, the homepage's FAQ and policies, the catalog, and `prompt.md`:
   ```sh
   node knowledge/scripts/build-bundle.mjs
   ```
   It writes `server/functions/_shared/knowledge.ts` (what the edge function imports), `eval/bundle.json` (what the eval runs against) and `../texting/knowledge.md` (what Evelyn's texting assistant reads, see `texting/SETUP.md`). Run it again after any change here, in the FAQ, in the catalog, or in `prompt.md`, then redeploy: `supabase functions deploy ask`.

## The files

| Path | What it holds |
|---|---|
| `prompt.md` | The assistant's instructions: how to answer, when to hand off. Stable text, cached on the server. |
| `client-questions/<group>.md` | The exact questions clients text her (before a visit, right after, routines, results, booking), with her answers. |
| `concerns/<concern>.md` | One per skin concern: her first questions, morning and night picks from the shelf, what to avoid, timeline, which facial, common mistakes, everyday habits, when it must come to her. |
| `treatments/explained/<treatment>.md` | What to expect from each treatment: the steps, how it feels, how they'll look after, how often, results, who it's for, who has to wait, pairings. |
| `treatments/<treatment>.md` | Aftercare per treatment: the first 24 hours, the first week, what's normal, what isn't. |
| `visits.md` | What to wear and bring, makeup, guests, a first visit, under-18s, payment, returns, how fast she replies. |
| `materials.md` | Her own cards, guides and posts, from screenshots. |
| `screenshots/<asset id>.md` | What each screenshot says, transcribed by `read-screenshots.mjs`. Folded into the card it was added to. |
| `products/<id>.md` | One per product on the shelf. Label facts (brand, size, label text) come from the packaging photos; "who, how, tip, pairs with, how long it lasts" are hers. |
| `routine.md` | The order of steps, how clients start the stronger products, what not to mix. |
| `hard-lines.md` | What the assistant must never answer. The code's own rules in `js/ask-rules.js` apply on top, always. |
| `voice.md` | Real replies she has sent, words she uses and avoids, how she opens and signs off. |
| `eval/questions.json` | 50 client questions with what a good answer must and must not say. `eval/run-eval.mjs` runs them. |

## Her voice memos

The playbook also takes voice memos per item: recorded in her phone's own recorder, then added with "Add a recording". They're kept in the questionnaire's file store, and the import notes each one's asset id in a comment on its card (comments never reach the assistant). To fetch one, use the Artifact tool's read with that id as `path`. They're for a later voice assistant in her own voice, which needs her consent, a voice provider, and the real website (the microphone doesn't work inside the preview viewer).

## Rules that don't depend on her answers, or on the model

`js/ask-rules.js` is plain code: reactions, pregnancy, medications, named conditions, "my skin" questions and emergencies always go to Evelyn before any AI runs, on the website and on the server alike. The bundle builder copies the same rules into the server's TypeScript and the eval.

## What never goes in here

Medical claims, product claims she hasn't made, prices or policies that differ from the homepage, anything about her finances, and anything that identifies a client (names, numbers, photos), including from her screenshots. If a file is empty, leave it empty: the assistant is safer not knowing than guessing.
