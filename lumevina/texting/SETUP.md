# Evelyn's texting assistant: setup

Evelyn texts herself a client's question from her iPhone; Claude, running on her Mac, texts back a draft reply built from her Skin Playbook, the FAQ and her shelf. She copies it and sends it to the client herself. Nobody else can reach it: only her own self-chat gets through, and this folder blocks Claude from opening files, running commands or browsing.

Built on Anthropic's iMessage channel for Claude Code (a research preview): https://code.claude.com/docs/en/channels

## What it needs

- A Mac signed into Evelyn's Apple ID in Messages, awake while she wants drafts.
- A Claude Pro or Max plan, signed in to Claude Code.
- About 15 minutes, once.

## Set it up (on the Mac, in Terminal)

1. **Bun** (the plugin runs on it):
   ```sh
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Claude Code**, then sign in when it asks:
   ```sh
   curl -fsSL https://claude.ai/install.sh | bash
   claude
   ```
3. **The iMessage plugin.** At Claude's prompt:
   ```
   /plugin install imessage@claude-plugins-official
   ```
   Choose the user scope. If it says the marketplace isn't found: `/plugin marketplace add anthropics/claude-plugins-official`, then install again. Then exit Claude (`/exit`).
4. **This folder.** Get the website's repository onto the Mac (`git clone` it, or `git pull` if it's already there) and go into this folder:
   ```sh
   cd ~/Claude/lumevina/texting
   ```
5. **Full Disk Access** for Terminal: System Settings → Privacy & Security → Full Disk Access → turn on Terminal. (The plugin reads the Messages database; without this it stops with "authorization denied".)
6. **Start it**, from this folder:
   ```sh
   claude --channels plugin:imessage@claude-plugins-official
   ```
   On a plan that includes it, `--model claude-fable-5-1` before `--channels` runs the drafts on Fable, the same model as the website's chat.
7. **Text yourself** from the iPhone (Messages → new message to your own number or Apple ID email). The first time Claude replies, the Mac asks whether Terminal may control Messages: click **OK**.
8. **Keep the Mac awake** while it's on duty: in a second Terminal tab run `caffeinate -dims`, or set the Mac never to sleep on power.

## Using it

Text yourself things like:
- "Client asked: can I work out after my facial tomorrow?"
- "Draft a reply: she wants to know if the Brazilian hurts the first time"
- Paste a client's whole message, then "reply to this"
- "What's my cancellation policy again?"

Claude texts back the draft only. When it doesn't know, it drafts a holding reply and adds a "Note:" telling her what's missing, which is also the cue to add it to the Skin Playbook. Medical and personal questions come back marked "this one's yours to answer."

## Keep it safe

- Don't run `/imessage:access allow` for clients, and leave SMS off (the plugin's default: SMS senders can be faked). This assistant is for Evelyn only.
- To stop it: press Ctrl+C twice in its Terminal window, or close the window.

## When her answers change

Everything it knows comes from `knowledge.md` in this folder, generated from her playbook answers. After new answers are imported (knowledge/README.md), rebuild, pull on the Mac, and restart step 6:
```sh
node knowledge/scripts/build-bundle.mjs      # from lumevina/, on the build side
git pull                                     # on the Mac
```
