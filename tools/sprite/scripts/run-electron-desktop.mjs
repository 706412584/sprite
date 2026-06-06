import { run } from "./package-utils.mjs";

await run(process.execPath, ["./node_modules/electron/cli.js", "."], {
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: "1",
  },
});
