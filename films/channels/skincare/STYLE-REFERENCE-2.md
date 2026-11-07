# Skin Sense: new visual reference (owner's pick, 7 Nov 2026)

The owner loves a set of ten medical-illustration slides from another creator's account and wants Skin Sense to
reach the same look, feel and finish. **Rules:** we use the *qualities* below as a reference. We never reuse those
images, the creator's name, wording, layout templates or credits, and we never imply any connection to her. Every
frame is our own artwork and our own words.

## What the reference does (the qualities to match)
- **Ground:** warm off-white / ivory, not dark. Images fade softly into the ivory at the top (title zone) and bottom
  (caption zone).
- **Hero art:** one large, photoreal "medical illustration" cross-section per slide: wet, translucent tissue, soft
  rim light, shallow depth of field, tiny capillaries, fibre texture, subtle micro-detail. Pinks, rose, amber and
  cream, with violet cell nuclei. Never plastic, never flat vector.
- **Type:** big high-contrast serif titles in deep navy, all caps; a small tracked-caps kicker above the title
  (for example "SEBACEOUS GLAND"); one calm sans-serif line of explanation; one bold takeaway line near the foot.
- **Labels:** small white rounded "pills" in tracked caps, with a thin leader line ending in a dot on the structure.
- **Footer:** series name in tracked caps, one hairline rule each side, a small citation line (authors, year).
- **Voice on screen:** short, hedged, mechanism-first sentences ("may", "can", "in cultured cells"). One idea per slide.
- **Diagrams:** a loop or flow built from soft pastel rounded boxes and dark arrows, with the hero art in a soft
  oval at the centre.

## How we build it (honest constraints)
Our pipeline is code-rendered 3D. Reaching this photoreal level in pure code is hard and slow. The practical route:
1. Make our own key-art stills for each beat with an image model (needs budget and an API key, stored in settings,
   never in chat; paid generation is off until the owner approves a budget).
2. Animate them in code: slow push-ins, parallax between layers, label pills drawing on, number counters, the
   citation footer. Typography, labels and timing stay in our own code so they are crisp and consistent.
3. Keep every claim hedged to its source and listed in claims.json. Skin Sense captions carry
   "Education, not medical advice". A dermatologist review remains the owner's call.

## Open decisions for the owner
- Image model and budget for the key art.
- Keep the "Skin Sense" name and teal accent, or move the palette to the ivory / navy / rose look above.
- Whether episodes 001-003 get redone in the new look.

## Format and plan (owner, 7 Nov 2026)
- **Shorts:** at least 60 seconds each (vertical 9:16) for YouTube Shorts, TikTok and Reels. One or two illustrated
  slides per idea, hedged wording, citation footer.
- **Long video:** after every 5-6 shorts, one long YouTube video (16:9, about 5-10 minutes) summarising those shorts:
  a hook, the mechanism slides in order, a recap "feedback loop" diagram near the end, a "what we know in people"
  slide and the takeaway. Each slide holds 10-25 s while the narration follows the on-screen text.
- **Order:** finish Skin Sense 001-006 as planned (001-003 stay as they are; 004-006 are in draft), then the first long
  video for them. After that, a new 5-short series on **sugar and acne** (our own angle and structure on the same
  science; never a copy of another creator's slide order), then its long video:
  1. where oil (sebum) comes from; 2. how a clogged pore forms; 3. bacteria and inflammation;
  4. sugar, insulin and acne: what research suggests and what it does not; 5. what happens in people when diet changes.
- **Art:** our own key art with an image model once the owner approves the budget (cap about $15; test 5-6 images across
  tiers first, mid tier expected). All text, labels and citations are drawn in code.
