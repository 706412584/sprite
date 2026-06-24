import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
// @ts-expect-error 本地 mjs 插件无类型声明
import { spriteflowProxy } from "./vite-plugin-spriteflow-proxy.mjs";

const pythonApiTarget = process.env.SPRITE_VIDEO_LAB_API_BASE || "http://127.0.0.1:8895";

export default defineConfig({
  base: "./",
  plugins: [react(), spriteflowProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 39200,
    strictPort: true,
    proxy: {
      "/api": pythonApiTarget,
      "/work": pythonApiTarget,
      "/media": pythonApiTarget,
    },
    watch: {
      ignored: ["**/.git/**", "**/dist/**", "**/release/**", "**/work/**", "**/node_modules/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 39201,
    strictPort: true,
  },
});
