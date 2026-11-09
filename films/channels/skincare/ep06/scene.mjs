// Skin Sense No. 006, "Same List as Cigarettes": new art direction; engine ../set/ss3.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/ss3.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
