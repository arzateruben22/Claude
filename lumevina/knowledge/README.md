# Knowledge: what Ask Lumevina answers from

Everything the website's assistant may say lives here: Evelyn's words, the studio's own facts, and a layer of general esthetics knowledge (`general/`) that lets it explain what things are and why a rule exists. The assistant answers only from this folder, the FAQ and policies on the homepage, her menu and her product catalog. Her words always win over the general layer, and anything about a particular client's own skin that she hasn't answered goes to her.

## Where answers come from

1. **Evelyn's Skin Playbook** (the questionnaire): https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ. She fills it in over several sittings; it saves per section. It opens on **Quick confirm**: a common answer is drafted for 147 of the questions (`scripts/playbook-drafts.mjs`, written from standard esthetics practice and her own menu descriptions), one at a time, and she taps **Yes, that's what I say**, **Fix it** (her version) or **Not this one**. Only what she confirms is saved, as her answer, in the same place the tabs write; a draft is never shown for a question she has already answered, and her decisions are kept in the `playbook/confirm` document. The same drafts are offered in Talk it through ("is that what you tell clients, or what would you change?"). The questions are in `PLAYBOOK-QUESTIONS.md`, generated from `scripts/playbook-spec.mjs`. It opens on **Questions clients ask**: 31 real texts clients send her ("When can I wear makeup again?", "Should I shave before my wax?"), each answered once in her words, so the assistant can answer them without her. Then skin concerns, each treatment explained (steps, feel, downtime, how often, who it's for), aftercare, visits, her routine, products, her own materials, hard lines and her voice.
   **Talk it through** (the first tab) opens on the **10-minute version**: the 26 questions clients ask most (before and after a visit, routines, results, which facial, facial aftercare, her routine order, what not to mix, a first visit, and her hard lines), asked back to back with a progress line and the minutes left; the rest can wait for another sitting ("Claude picks", or a topic). Either way Claude interviews her one question at a time, with a follow-up when an answer is too vague for a client to act on, and saves what she says into the same answers (lightly cleaned, in her words; it never suggests answers or gives advice). She types, dictates with the keyboard's mic key, or uses the mic button where her browser allows; Claude's questions can be read aloud. Each saved answer shows as a chip she can tap to check or edit in its tab. It runs on her own Claude account (the page's `sample` capability); the conversation is kept in the `playbook/interview` document as a record, and its answers are already in the section documents, so the import below needs nothing extra.
   **What she has answered folds away.** On every card, the questions she has answered fold under "N questions answered already" (tap to check or change), so only the open ones show; a card with every question answered folds to the end of its tab. This happens when she opens the page, a tab or a card, never while she's typing. The interview already skips answered questions.
2. **Screenshots count as answers.** Every card has **Add screenshots**: old texts to clients, aftercare cards, product guides, Instagram posts, as images or PDFs (an iPhone photo the store can't take is converted to JPEG on her phone). They're kept in the questionnaire's asset store, listed in that card's answers. To read them, download each with the Artifact tool (read, `path` = the asset id) into a folder named by id, then:
   ```sh
   node knowledge/scripts/read-screenshots.mjs <answers folder> <screenshots folder>
   ```
   With `ANTHROPIC_API_KEY` set it transcribes each one into `screenshots/<id>.md`: her words exactly, clients' names, numbers and photos left out, and "keep: no" for anything with nothing of hers in it. Without a key it lists what still needs reading; Claude in a session can read them and write the same files. **Read every transcript before the next step**: it goes into what the assistant says.
3. **Her answers become files here.** Export the questionnaire's saved sections (the `playbook` collection: one JSON file per section, named by section id: `client-questions.json`, `concerns.json`, `treatments.json`, `aftercare.json`, `visits.json`, `routine.json`, `products.json`, `materials.json`, `hard-lines.json`, `voice.json`) into a folder, then:
   ```sh
   node knowledge/scripts/import-playbook.mjs <that folder>      # from lumevina/
   ```
   That writes `client-questions/*.md`, `concerns/*.md`, `treatments/explained/*.md`, `treatments/*.md`, `products/*.md`, `visits.md`, `routine.md`, `materials.md`, `hard-lines.md` and `voice.md`, each dated in `answered:`, with what her screenshots say under "From her screenshots" on the card she added them to. A skipped question keeps "_(not answered yet)_", and the assistant hands those to her. Her words are never changed; when an answer clearly belongs to another question (her routines "for morning" typed in the Night box), the import adds a note under it telling the assistant how to read it.
4. **The bundle the server reads** is generated from these files, the homepage's FAQ and policies, the catalog, and `prompt.md`:
   ```sh
   node knowledge/scripts/build-bundle.mjs
   ```
   Along with the FAQ it packs "Her treatments, in her words": every service on her menu (`js/services.js`) with its price, time, deposit and her GlossGenius description, so the assistant can say what a facial includes and which one fits. It writes `server/functions/_shared/knowledge.ts` (what the edge function imports), `eval/bundle.json` (what the eval runs against) and `../texting/knowledge.md` (what Evelyn's texting assistant reads, see `texting/SETUP.md`). Run it again after any change here, in the FAQ, in the catalog, or in `prompt.md`, then redeploy: `supabase functions deploy ask`.
5. **Skin School grows from the same files.** `node knowledge/scripts/build-course-notes.mjs` maps her answers, the general layer and her shelf onto each lesson of the course (`docs/school/notes.js`: "Evelyn says" only where she has answered, "The general picture" hedged, "On Evelyn's shelf" with label lines); `node docs/school/visuals/build-visuals.mjs` draws the lesson diagrams in code (`img/school/`, and warns about any label that runs past the frame or sits on another: fix the diagram and rebuild); then `python3 docs/school/build.py` rebuilds `school.html`. Run the notes step after every import.
6. **The preview chat answers with Claude too.** `scripts/build-single-file.mjs` puts `eval/bundle.json` in the single-file page, and the chat there asks Claude on the viewer's own Claude account (the page's `sample` capability, so publish the preview with `capabilities: {"sample": {}}`; the first question asks the viewer to allow it). The same rules run first, then the same instructions, facts, treatments, playbook and shelf as the server, plus the signed-in client's skin profile and what they've told it; what a signed-in client says about their routine is kept in their profile. Answers stream in as they're written. Without Claude (a saved copy, or a viewer who declines), the keyword answers stand, and a question her playbook clearly answers gets her own words. The live website asks the server instead.

## The files

| Path | What it holds |
|---|---|
| `prompt.md` | The assistant's instructions: how to answer, how it sounds (a real person at the front desk; matches the client's energy; reads shorthand and typos without correcting them; no emoji by default), when to hand off. Stable text, cached on the server. |
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
| `general/*.md` | Not hers: standard esthetics knowledge for the assistant (how skin works, ingredients, routines, treatments, aftercare, waxing, common concerns, red flags and scope). It explains and fills gaps; her playbook wins where they differ; it is never used to diagnose, to call something normal, to change a routine or to decide a contraindication. Edit freely; rebuild the bundle after. |
| `scripts/playbook-drafts.mjs` | The drafted common answers Quick confirm and Talk it through offer her. Nothing in it reaches the assistant until she confirms it. |
| `eval/questions.json` | 50 client questions with what a good answer must and must not say. `eval/run-eval.mjs` runs them. |

## Her voice memos

The playbook also takes voice memos per item: recorded in her phone's own recorder, then added with "Add a recording". They're kept in the questionnaire's file store, and the import notes each one's asset id in a comment on its card (comments never reach the assistant). To fetch one, use the Artifact tool's read with that id as `path`. They're for a later voice assistant in her own voice, which needs her consent, a voice provider, and the real website (the microphone doesn't work inside the preview viewer).

## The general layer

`general/` is the esthetics textbook the assistant can lean on: what a kind of treatment or ingredient does, the usual aftercare and why, standard contraindications, when something is a doctor's. It's written hedged ("generally", "usually") and without product claims. The bundle marks it as not hers and tells the assistant the precedence: her playbook, her treatments and the FAQ first; the general layer to explain and to fill a gap; nothing from it to diagnose or to decide for a client. When the assistant hands a question to Evelyn, it may add one or two general sentences the client sees while they wait (the rule that applies, why it's her call), never a judgement about that client's skin.

## Rules that don't depend on her answers, or on the model

`js/ask-rules.js` is plain code: reactions, pregnancy, medications, named conditions, "my skin" questions and emergencies always go to Evelyn before any AI runs, on the website and on the server alike. The bundle builder copies the same rules into the server's TypeScript and the eval. Both sides run the rules on the message as typed and as the client meant it: `js/ask-typos.js` (and its server copy, `_shared/typos.ts`, fed the same word lists by the bundle) expands texting shorthand (wdym, idk, b4, appt, w/) and corrects misspelled topic words ("pregnent", "brazillian", "facail"), so "im pregnent" is still a hand-off. Nothing is ever corrected back at the client.

## What never goes in here

Medical claims, product claims she hasn't made, prices or policies that differ from the homepage, anything about her finances, and anything that identifies a client (names, numbers, photos), including from her screenshots. If a file is empty, leave it empty: the assistant is safer not knowing than guessing.
