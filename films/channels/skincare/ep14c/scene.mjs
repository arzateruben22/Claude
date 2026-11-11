// Skin Sense Season 3, Episode 2 ("Where Do Your Skin Cells Go?", ASMR, a real person's voice): set/cells3d.js under the overlay of ../set/night.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/night.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
