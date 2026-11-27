import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";
import { createHash } from "node:crypto";
import { config } from "./src/config.js";
import { startScheduler, getSnapshot, refreshAll } from "./src/monitor.js";
import { fetchBlackBitCandles } from "./src/adapters/blackbit.js";
import { fetchWinanceCandles } from "./src/adapters/winance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json; charset=utf-8"};

function send(res, status, data, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}
function sendStatic(req, res, body, type, stat) {
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const headers = {"Content-Type":type,"Cache-Control":(type.includes("text/html") || type.includes("javascript"))?"no-cache":"public, max-age=300, stale-while-revalidate=86400", "ETag":etag,"Last-Modified":stat.mtime.toUTCString(),"X-Content-Type-Options":"nosniff","Vary":"Accept-Encoding"};
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
  const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "") && body.length > 1024 && !type.includes("image/");
  if (acceptsGzip) { headers["Content-Encoding"]="gzip"; res.writeHead(200, headers); const gzip=createGzip({level:6}); gzip.pipe(res); gzip.end(body); }
  else { res.writeHead(200, headers); res.end(body); }
}
async function handler(req,res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    const isRefresh = url.pathname === "/api/refresh";
    if (isRefresh ? !["POST", "GET"].includes(req.method) : req.method !== "GET") {
      res.setHeader("Allow", isRefresh ? "GET, POST" : "GET");
      return send(res,405,{error:"Method not allowed"});
    }
    if (url.pathname === "/api/health") return send(res,200,{ok:true,service:"CashFlow Ecosystem Monitor",pollIntervalMs:config.pollIntervalMs,now:new Date().toISOString()});
    if (url.pathname === "/api/status") return send(res,200,getSnapshot());
    if (url.pathname === "/api/candles") {
      const source = url.searchParams.get("source");
      const pair = url.searchParams.get("pair") || "erubUsdt";
      const interval = Number(url.searchParams.get("interval"));
      const allowed = new Set([60,300,900,3600,14400,86400]);
      if (!allowed.has(interval) || !["blackbit","winance"].includes(source) || (source === "winance" && !["erubUsdt","erubRub"].includes(pair))) return send(res,400,{error:"Invalid candle query"});
      try {
        const candles = source === "blackbit" ? await fetchBlackBitCandles(interval) : await fetchWinanceCandles(pair,interval);
        return send(res,200,{source,pair,interval,candles,receivedAt:new Date().toISOString()});
      } catch (error) { return send(res,502,{error:"Candle history unavailable",message:error.message}); }
    }
    if (url.pathname === "/api/refresh") {
      try { await refreshAll(); return send(res,200,getSnapshot()); }
      catch(e) { return send(res,502,{error:"Refresh failed",message:e.message}); }
    }
    if (url.pathname === "/api/history") {
      const snap = getSnapshot();
      return send(res,200,{history:snap.history || []});
    }
    return send(res,404,{error:"API route not found"});
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(res,400,"Bad URL","text/plain; charset=utf-8"); }
  if (pathname === "/") pathname = "/index.html";
  const target = path.resolve(publicDir, "." + pathname);
  const relative = path.relative(publicDir, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return send(res,403,"Forbidden","text/plain; charset=utf-8");
  try {
    const [body, stat] = await Promise.all([fs.readFile(target), fs.stat(target)]);
    sendStatic(req,res,body,mime[path.extname(target)] || "application/octet-stream",stat);
  } catch { send(res,404,"Not found","text/plain; charset=utf-8"); }
}
startScheduler();
http.createServer((req,res)=>handler(req,res).catch(e=>{
  console.error("Request failed:", e);
  if (!res.headersSent) send(res,500,{error:"Internal server error",message:"Request could not be completed"});
  else res.destroy();
})).listen(config.port,"0.0.0.0",()=>console.log(`CashFlow Monitor listening on ${config.port}`));
