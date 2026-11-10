// Skin Sense S2 E2, "Why Fingers Wrinkle in Water", 3-D: set/finger3d.js (three.js, shared base set/w3d.js) under the overlay of ../set/ss3.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/ss3.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
