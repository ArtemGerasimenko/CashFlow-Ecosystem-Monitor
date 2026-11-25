import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../data");
const file = path.join(dir,"monitor-history.json");
let state = { updatedAt:null, sources:{}, history:[] };
export async function loadStore() {
  await fs.mkdir(dir,{recursive:true});
  try { state = JSON.parse(await fs.readFile(file,"utf8")); }
  catch { await persist(); }
}
export function readState(){ return structuredClone(state); }
export async function updateSource(name, value) {
  state.sources[name] = value;
  state.updatedAt = new Date().toISOString();
  if (value?.ok && value.data) {
    state.history.push({source:name,at:state.updatedAt,data:value.data});
    // 0 means keep history indefinitely.
    const retention = Number(process.env.HISTORY_RETENTION_DAYS || 0);
    if (retention > 0) {
      const cutoff = Date.now() - retention*86400000;
      state.history = state.history.filter(x=>Date.parse(x.at)>=cutoff);
    }
  }
  await persist();
}
async function persist(){ await fs.writeFile(file,JSON.stringify(state,null,2),"utf8"); }
await loadStore();
