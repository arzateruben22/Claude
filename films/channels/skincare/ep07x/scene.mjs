// Skin Sense S2 E1, "Why Goosebumps Happen", 3-D prototype: set/goose3d.js (three.js) under the overlay of ../set/ss3.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/ss3.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
