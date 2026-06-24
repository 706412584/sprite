import { spawn } from "node:child_process";
import process from "node:process";

export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

export function assertWindows() {
  if (process.platform !== "win32") {
    throw new Error("Windows 打包脚本只能在 Windows 上运行。");
  }
}
