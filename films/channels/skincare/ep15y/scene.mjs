// Skin Sense Season 3, Episode 3 ("What Is Actually Inside a Pore?", ASMR, a real person's voice): set/pore3d.js under the overlay of ../set/night.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/night.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
