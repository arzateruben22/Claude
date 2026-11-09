// Skin Sense No. 005, "The Sunscreen Experiment": new art direction; see ../set/ss2.mjs and episode.json.
import { stage } from "cinema/film/runtime.js";
import { run } from "../set/ss2.mjs";
await run({ stage, FILM: window.FILM, W: window.W, H: window.H, EP: await (await fetch("episode.json")).json() });
