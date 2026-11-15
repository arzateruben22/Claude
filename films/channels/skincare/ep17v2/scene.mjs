// Skin Sense Season 3, Episode 5 ("Every Hair on You Is Scheduled to Fall Out", ASMR, a real person's voice): set/hair3d.js under the overlay of ../set/night.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/night.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
