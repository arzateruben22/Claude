# Project OC — Claude master prompt

Continue developing our existing Anaheim / Orange County free-roam game using the project, code, locations, and decisions already established in this Claude conversation. This is an implementation brief: inspect the project, make the changes, run it, inspect the results, and keep improving the playable build.

The creative target is a grounded, highly realistic open-world driving and nightlife experience: drive through Anaheim, park, get out, walk into the local bar we already discussed, interact with people, leave, and drive away. Preserve the project's existing name if it has changed from Project OC. Use original project assets and identity throughout.

## 1. Lock the current roster to these six people

Use the **six characters we just generated in the other ChatGPT chats on November 11, 2026**. The attached images are the actual references. They are three men and three women: six total. Any spoken mention of “three” means three per group; it does not reduce the total to three.

These six are the only playable base characters and the only human appearance archetypes for current NPCs. Reuse them across the world. Do not invent a larger crowd roster, substitute unrelated faces, or build separate character-control implementations for twenty types of people.

The IDs below are technical labels, not proposed character names. Preserve established names from our project if names already exist.

| ID | Character identity and proportions | Canonical clothing | Latest portrait sheet |
| --- | --- | --- | --- |
| M01 | Fictional Black American man, 38, 188 cm, tall and muscular; deep brown skin, brown eyes, shaved head, short full beard with a few grey hairs, small scar through the left eyebrow | Navy short-sleeve henley, sand chino shorts just above the knee, brown leather sandals; sunglasses on top of his head | `references/01_M01_portrait.png` |
| M02 | Fictional Mexican American man, 27, 175 cm, stocky athletic build and broad shoulders; warm medium-brown skin, dark brown eyes, short black skin fade with a textured top, neatly trimmed short full beard | Open charcoal canvas work jacket, plain white crew-neck T-shirt, dark navy straight work pants, black leather lace-up work boots, thin silver chain | `references/02_M02_portrait.png` |
| M03 | Fictional Vietnamese American man, 31, 172 cm, slim build; light tan skin, dark brown eyes, black side-parted undercut, clean-shaven, thin black rectangular glasses | Open light heather-grey overshirt, plain white T-shirt, slim olive chinos rolled once at the ankle, plain white minimal leather sneakers, plain steel wristwatch | `references/03_M03_portrait.png` |
| F01 | Fictional Filipino American woman, 24, 160 cm, petite athletic build; warm light-brown skin, dark brown eyes, long straight black hair in a high ponytail with loose strands around the face | Cropped olive bomber jacket, white tank top, light-wash straight jeans, white sneakers; match visible accessories to the images | `references/04_F01_portrait.png` |
| F02 | Fictional Iranian American woman, 29, 168 cm, slim build; light olive skin, hazel eyes, defined brows, dark brown shoulder-length waves with a side part, small gold hoop earrings | Open tailored cream blazer, fitted black top, high-waisted black straight trousers, black pointed low-heel shoes | `references/05_F02_portrait.png` |
| F03 | Fictional white American woman, 35, 175 cm, tall athletic swimmer's build; lightly tanned skin, freckles over nose and cheeks, blue-grey eyes, sun-bleached dirty-blonde shoulder-length hair in a low loose ponytail | Faded light-blue denim shirt with sleeves rolled up; preserve the rest of her outfit from our existing project or earlier established character brief | `references/06_F03_portrait.png` |

Open and inspect all six portrait images before changing character assets. Each sheet shows the same person from the front, side, and three-quarter angle. Keep facial structure, hairline, nose, jaw, eyes, skin tone, freckles, beard, glasses, and identifying accessories consistent across views and throughout animation.

Three additional current full-body sheets are supplied:

- M01: `references/body/M01_body.png`
- F01: `references/body/F01_body.png`
- F02: `references/body/F02_body.png`

There are **nine reference PNGs in this handoff: six portrait sheets and three body sheets**. No full-body sheet is supplied here for M02, M03, or F03. Use their latest portraits, the descriptions above, and any established matching body reference already in our project. If a required view or part of an outfit remains unspecified, record that narrow gap and use an editable provisional choice; keep development moving without changing the person's identity. Do not claim an absent reference was attached or inspected.

The latest portraits control facial identity. The matching body sheets control silhouette and clothing where available. Text supplies details that a sheet does not show. If these conflict, preserve the latest depicted face and record the specific mismatch instead of blending different people together.

The reference style is stylized-realistic 3D console-game art. Push the in-game materials, lighting, anatomy, movement, and detail toward the most convincing realism the actual project can support while keeping these exact six identities.

## 2. Continue the existing project and asset pipeline

Read the repository instructions and inspect the engine, renderer, dependencies, existing player controller, vehicle controller, character assets, NPC logic, scene structure, and save system. Preserve working features and use the established stack. Keep the existing browser build working if present; continue a separate downloadable or Unreal track only if that track already exists or our earlier project decisions explicitly call for it.

Identify what currently exists versus what needs to be produced. These PNGs are visual references, not rigged meshes, texture sets, or playable characters. Use actual available modeling, asset-generation, import, and rendering tools. Where tooling is missing, implement the usable parts of the pipeline, document the exact missing input, and continue independent work. Never describe a reference image, unrigged mesh, or missing file as a finished playable model.

Build one data-driven character catalog and shared systems. Give every base character a stable ID, portrait reference, mesh and material references, rig mapping, height/proportion data, wardrobe slots, animation configuration, and unlock category. The supplied `character_roster.json` describes the reference roster; adapt it to the project's existing configuration format. It does not contain finished model assets.

Use shared locomotion, interaction, animation, and vehicle-entry systems, with compatible rigs or explicit retargeting where needed. Player input and NPC behavior should drive the same reusable character foundation. Character-specific appearance belongs in data and assets, not copied controller code.

Produce or refine genuine 3D assets with usable topology, UVs, appropriate materials, rigging, skin weights, collision, and levels of detail. Preserve distinct silhouettes and heights. Reuse geometry, textures, materials, and animation resources wherever appropriate. Do not present capsules, featureless mannequins, flat portrait billboards, or missing-texture models as the finished six characters.

## 3. Reuse the six for NPCs

Render the same six base character assets repeatedly as pedestrians, patrons, bartenders, and other established NPC roles. NPCs need independent behavior and state, not new face-generation pipelines.

Create variety through routes, schedules, positions, conversation or idle timing, gestures, wardrobe tints, and compatible accessory choices. Keep each base face, skin tone, defining hair, and body proportions recognizable. Keep the canonical outfits available for player selection. Avoid placing obvious identical copies side by side when scheduling or composition can prevent it.

Use the crowd optimizations supported by the actual engine: appropriate LODs, pooling, culling, animation update budgets, and resource sharing. Use instancing only where the renderer supports the required asset and animation type. Do not assume all animated humanoids can be batched identically.

## 4. Finish one convincing Anaheim gameplay loop

Use the Anaheim bar, street, and local references already established in this Claude conversation or repository. Preserve that context. If a location detail is missing from the available context, put it in a clearly editable setting instead of inventing a real venue name, address, or verified layout.

Implement and verify this sequence in the actual playable build:

1. Select any of the six base characters and spawn correctly.
2. Drive an existing vehicle to the bar area and park.
3. Exit the vehicle into a safe, unoccupied position with a sensible camera transition.
4. Walk, turn, and move naturally along the sidewalk and through the entrance.
5. Enter the bar with working collision, believable scale, interior lighting, and ambient sound.
6. Encounter NPCs using the six approved appearances; complete a basic interaction using the project's established interaction system.
7. Leave the bar, re-enter the vehicle, and drive away.
8. Reload the game and restore supported persistent state, including selected character, without corrupting vehicle or scene state.

Make doorways, seating, counters, curb heights, character scale, vehicle seats, feet, hands, and camera placement feel physically coherent. Handle blocked exits, repeated interactions, character swaps, and interior/exterior transitions without stuck characters or duplicate input control. Use development warps or test shortcuts only as aids; the normal gameplay path must work.

## 5. Push graphics through repeated in-game inspection

Quality is the priority. Invest substantial development effort and available weekly usage in visible improvements. Do not impose an arbitrary quick-demo quality ceiling. Work through implementation, rendering, inspection, correction, and another verified build.

Prioritize:

- Convincing silhouettes, facial structure, hands, hair shape, clothing fit, and character-to-vehicle scale.
- Physically coherent skin, hair, cloth, leather, metal, glass, and road materials; use actual texture and material inputs rather than excessive surface noise.
- Balanced outdoor daylight and believable bar lighting, with the renderer's supported shadows, reflections, exposure, and color management.
- Grounded feet, weight transfer, smooth turns, vehicle entry and exit, idle variation, and stable animation transitions.
- An Anaheim streetscape and bar with believable proportions, curb and pavement detail, signs, furnishings, and ambient activity drawn from the existing references.

Inspect real gameplay captures at repeatable locations: neutral character lighting, the street, the vehicle, the bar entrance, and the bar interior. Compare the six faces and silhouettes against their supplied references. Inspect every character up close and at ordinary gameplay distance. Use side-by-side captures and measured frame/memory data to decide the next improvements.

Provide the highest practical quality preset and scalable settings for the actual supported hardware. State the test hardware, resolution, settings, and observed performance where measurable. Do not claim a performance result you have not measured. Improve frame stability alongside visual detail so the result remains playable.

A beautiful promotional render does not complete this work. The characters must look and move convincingly inside the functioning gameplay loop.

## 6. Plan an optional two-character cosmetic pack

Prepare the design and clean extension points for a future paid pack containing **two additional fictional adult characters: one man and one woman**. Both should look striking, athletic, muscular, and well defined, with realistic anatomy and premium styling that fits the world.

| Item | Decision |
| --- | --- |
| Base game | Six current playable characters |
| Future pack | One additional male character and one additional female character, sold together |
| Proposed price | A one-time **$5 or $10 USD for the pair**; final price remains undecided |
| Price implementation | One configurable pack price; do not invent two pricing tiers or silently lock the final price |
| Gameplay effects | Cosmetic identities and presentation; preserve equivalent gameplay capabilities |
| Current implementation | Six base characters remain active; prepare catalog, unlock, and selection extension points for the future pack |
| Future enabled roster | Eight total playable identities for a player who owns the completed pack |

Do not replace any of the six base characters or add the premium pair to the current NPC appearance pool. Do not generate or ship the two premium identities during this six-character implementation unless our existing project scope already includes them. The pack is a future plan, with any preview clearly marked as a concept.

Keep production entitlements compatible with trusted purchase verification. A local development unlock can be a clearly labeled test aid, not proof of ownership. Do not activate live payments, purchase assets, or subscribe to services as part of this implementation brief.

## 7. Keep making progress across sessions

Use the available development tools and session budget fully for meaningful implementation and verification. Continue into the next useful task when one milestone passes; do not repeatedly ask whether to continue. Resolve routine implementation choices from the project and this brief.

At the start of a session, read the current checkpoint and select the highest-impact unfinished task. During development, keep the build runnable, record material changes, and compare results against a baseline. Spend iterations on concrete visual or gameplay defects rather than repeatedly rendering unchanged scenes.

A prompt cannot bypass tool availability, context limits, execution limits, or usage caps. When an actual limit or unresolved dependency prevents further work, save a precise checkpoint and a ready-to-use continuation instruction. Do not promise unattended work after the session ends or claim a render ran when it did not.

Maintain concise project notes in the existing documentation structure, including:

- The six-character catalog and asset status, including missing meshes, textures, rigs, or views.
- Completed changes and the exact reproduction steps for the playable bar loop.
- Verified build/test results, screenshots or recordings when available, and any unverified items.
- Observed performance and the highest-impact remaining visual defects.
- The next concrete task and how to resume it.

## 8. Acceptance criteria and immediate action

This milestone is complete when all six base identities appear in the character selector, are playable, are reused by NPCs, remain visually consistent with their latest references, and can complete the drive → park → exit → enter bar → interact → leave → drive sequence. The build must preserve supported saves and remain stable at the measured settings. The future cosmetic pack must be represented as an undecided-price plan or clearly labeled development scaffold.

Start by inspecting the existing project and all nine supplied images. Briefly report the current engine, real asset inventory, and the first concrete improvement you are implementing. Then perform the work. End each work session with actual changes, actual verification, current blockers, and the next continuation task.
