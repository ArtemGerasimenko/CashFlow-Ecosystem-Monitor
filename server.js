import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { config } from "./src/config.js";
import { startScheduler, getSnapshot, refreshAll } from "./src/monitor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};

function send(res, status, data, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}
async function handler(req,res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET") return send(res,405,{error:"Method not allowed"});
    if (url.pathname === "/api/health") return send(res,200,{ok:true,service:"CashFlow Ecosystem Monitor",pollIntervalMs:config.pollIntervalMs,now:new Date().toISOString()});
    if (url.pathname === "/api/status") return send(res,200,getSnapshot());
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
    const body = await fs.readFile(target);
    send(res,200,body,mime[path.extname(target)] || "application/octet-stream");
  } catch { send(res,404,"Not found","text/plain; charset=utf-8"); }
}
startScheduler();
http.createServer((req,res)=>handler(req,res).catch(e=>send(res,500,{error:"Internal server error",message:e.message}))).listen(config.port,"0.0.0.0",()=>console.log(`CashFlow Monitor listening on ${config.port}`));
