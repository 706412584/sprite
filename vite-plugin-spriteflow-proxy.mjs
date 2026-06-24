/**
 * Dev-only proxy for SpriteFlow.
 *
 * 浏览器 dev 模式不能直接 POST 到多数 OpenAI-compatible 网关，
 * 因为 Authorization header 会触发 CORS 预检。Electron 桌面模式可直连，
 * Vite dev 模式走这个中转入口。
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const RELAY_PATH = "/__sf_relay__";

function readJsonBody(req, limitBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("Relay payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        if (chunks.length === 0) return resolve({});
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function allowedHosts() {
  const raw = process.env.VITE_SPRITEFLOW_PROXY_HOSTS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowed(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const hosts = allowedHosts();
  if (hosts.length === 0) return true;
  return hosts.includes(parsed.host);
}

function normalizeTimeoutMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 600000;
  return Math.min(Math.max(n, 30000), 15 * 60 * 1000);
}

function relayErrorMessage(err) {
  const raw = err && err.message ? String(err.message) : String(err || "Unknown upstream error");
  if (/\bECONNRESET\b/i.test(raw)) {
    return "Relay upstream error: upstream connection was reset (ECONNRESET). The image gateway closed the connection before returning a result; this is often caused by a long-running generation, gateway load/limits, an oversized edit image, or unsupported image parameters.";
  }
  if (/Upstream timeout/i.test(raw)) {
    return "Relay upstream error: upstream request timed out before the image gateway returned a result.";
  }
  return `Relay upstream error: ${raw}`;
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s.exec(dataUrl || "");
  if (!match) throw new Error("Invalid relay file data URL");
  const mime = match[1] || "application/octet-stream";
  const body = match[2] || "";
  return { mime, buffer: Buffer.from(body, "base64") };
}

function buildMultipartBody(fields, files) {
  const boundary = `----spriteflow-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields || {})) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`));
  }
  for (const file of files || []) {
    const { mime, buffer } = dataUrlToBuffer(file.dataUrl);
    const safeName = String(file.filename || `${file.name || "image"}.png`).replace(/[\r\n"]/g, "_");
    const field = String(file.name || "image").replace(/[\r\n"]/g, "_");
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${safeName}"\r\nContent-Type: ${file.type || mime}\r\n\r\n`,
      ),
    );
    parts.push(buffer);
    parts.push(Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

export function spriteflowProxy() {
  return {
    name: "vite-plugin-spriteflow-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(RELAY_PATH, async (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let payload;
        try {
          payload = await readJsonBody(req);
        } catch (e) {
          res.statusCode = 400;
          res.end(`Bad relay body: ${e.message}`);
          return;
        }

        const { url: target, method = "GET", headers = {}, body, encoding, files, timeoutMs } = payload || {};
        if (typeof target !== "string" || !target) {
          res.statusCode = 400;
          res.end("Missing target url");
          return;
        }
        if (!isAllowed(target)) {
          res.statusCode = 403;
          res.end("Target host not allowed");
          return;
        }

        let parsed;
        try {
          parsed = new URL(target);
        } catch {
          res.statusCode = 400;
          res.end("Invalid url");
          return;
        }

        const lib = parsed.protocol === "https:" ? https : http;
        const outHeaders = { ...headers };
        if (!outHeaders["User-Agent"] && !outHeaders["user-agent"]) {
          outHeaders["User-Agent"] = "sprite-video-lab-spriteflow-relay/0.1";
        }
        let outgoingBody = body;
        if (encoding === "multipart-data-url") {
          let fields = {};
          try {
            fields = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
          } catch {
            fields = {};
          }
          const multipart = buildMultipartBody(fields, files);
          outgoingBody = multipart.body;
          delete outHeaders["Content-Type"];
          delete outHeaders["content-type"];
          outHeaders["Content-Type"] = `multipart/form-data; boundary=${multipart.boundary}`;
          outHeaders["Content-Length"] = String(multipart.body.length);
        } else if (body && !outHeaders["Content-Type"] && !outHeaders["content-type"]) {
          outHeaders["Content-Type"] = "application/json";
        }

        const upstream = lib.request(
          {
            method,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
            path: parsed.pathname + parsed.search,
            headers: outHeaders,
          },
          (upRes) => {
            res.statusCode = upRes.statusCode || 502;
            const passthrough = ["content-type", "cache-control", "content-encoding"];
            for (const key of passthrough) {
              const v = upRes.headers[key];
              if (typeof v === "string") res.setHeader(key, v);
            }
            res.setHeader("x-sf-relay", "1");
            upRes.pipe(res);
          },
        );

        upstream.setTimeout(normalizeTimeoutMs(timeoutMs), () => {
          upstream.destroy(new Error("Upstream timeout"));
        });

        upstream.on("error", (err) => {
          if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: relayErrorMessage(err) }));
          } else {
            try {
              res.end();
            } catch {
              /* ignore */
            }
          }
        });

        if (outgoingBody && method !== "GET" && method !== "HEAD") {
          upstream.end(Buffer.isBuffer(outgoingBody) || typeof outgoingBody === "string" ? outgoingBody : JSON.stringify(outgoingBody));
        } else {
          upstream.end();
        }
      });
    },
  };
}
