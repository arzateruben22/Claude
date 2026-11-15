// Skin Sense Season 3, Episode 4 ("How One Pore Turns Into a Pimple", ASMR, a real person's voice): set/plug3d.js under the overlay of ../set/night.mjs; cues in episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/night.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
