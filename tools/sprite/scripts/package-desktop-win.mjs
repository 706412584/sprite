import { assertWindows, run } from "./package-utils.mjs";

assertWindows();
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

console.log("[sprite] building React app...");
await run("npm", ["run", "build"]);

console.log("[sprite] packaging Windows desktop app...");
await run("npx", ["electron-builder", "--win", "nsis", "--publish", "never"]);

console.log("[sprite] done. Output: release/desktop");
