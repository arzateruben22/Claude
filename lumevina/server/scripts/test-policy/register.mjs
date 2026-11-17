// Lets the edge-function code run under Node for tests: `npm:` imports become small stand-ins.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
