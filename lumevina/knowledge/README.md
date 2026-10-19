# Knowledge: what Ask Lumevina answers from

Everything the website's assistant may say lives here, in Evelyn's words, plus the studio's own facts. The assistant answers only from this folder, the FAQ and policies on the homepage, and her product catalog. Anything else goes to her.

## Where answers come from

1. **Evelyn's Skin Playbook** (the questionnaire): https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ. She fills it in over several sittings; it saves per section. The questions are in `PLAYBOOK-QUESTIONS.md`, generated from `scripts/playbook-spec.mjs`.
2. **Her answers become files here.** Export the questionnaire's saved sections (the `playbook` collection: one JSON file per section, named `concerns.json`, `aftercare.json`, `routine.json`, `products.json`, `hard-lines.json`, `voice.json`) into a folder, then:
   ```sh
   node knowledge/scripts/import-playbook.mjs <that folder>      # from lumevina/
   ```
   That writes `concerns/*.md`, `treatments/*.md`, `products/*.md`, `routine.md`, `hard-lines.md` and `voice.md`, each dated in `answered:`. A skipped question keeps "_(not answered yet)_", and the assistant hands those to her.
3. **The bundle the server reads** is generated from these files, the homepage's FAQ and policies, the catalog, and `prompt.md`:
   ```sh
   node knowledge/scripts/build-bundle.mjs
   ```
   It writes `server/functions/_shared/knowledge.ts` (what the edge function imports) and `eval/bundle.json` (what the eval runs against). Run it again after any change here, in the FAQ, in the catalog, or in `prompt.md`, then redeploy: `supabase functions deploy ask`.

## The files

| Path | What it holds |
|---|---|
| `prompt.md` | The assistant's instructions: how to answer, when to hand off. Stable text, cached on the server. |
| `concerns/<concern>.md` | One per skin concern: her first questions, morning and night picks from the shelf, what to avoid, timeline, which facial, when it must come to her. |
| `treatments/<treatment>.md` | Aftercare per treatment: the first 24 hours, the first week, what's normal, what isn't. |
| `products/<id>.md` | One per product on the shelf. Label facts (brand, size, label text) come from the packaging photos; "who, how, tip" are hers. |
| `routine.md` | The order of steps, how clients start the stronger products, what not to mix. |
| `hard-lines.md` | What the assistant must never answer. The code's own rules in `js/ask-rules.js` apply on top, always. |
| `voice.md` | Real replies she has sent, words she uses and avoids, how she opens and signs off. |
| `eval/questions.json` | 50 client questions with what a good answer must and must not say. `eval/run-eval.mjs` runs them. |

## Her voice memos

The playbook also takes voice memos per item: recorded in her phone's own recorder, then added with "Add a recording". They're kept in the questionnaire's file store, and the import lists each one under "Voice notes" with its asset id. To fetch one, use the Artifact tool's read with that id as `path`. They're for a later voice assistant in her own voice, which needs her consent, a voice provider, and the real website (the microphone doesn't work inside the preview viewer).

## Rules that don't depend on her answers, or on the model

`js/ask-rules.js` is plain code: reactions, pregnancy, medications, named conditions, "my skin" questions and emergencies always go to Evelyn before any AI runs, on the website and on the server alike. The bundle builder copies the same rules into the server's TypeScript and the eval.

## What never goes in here

Medical claims, product claims she hasn't made, prices or policies that differ from the homepage, and anything about her finances. If a file is empty, leave it empty: the assistant is safer not knowing than guessing.
