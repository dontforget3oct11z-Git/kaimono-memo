// stores.json のお店を順に読み取り、deals.json に書き出す（GitHub Actions から毎朝実行）
import { readFile, writeFile } from "node:fs/promises";
import { sources } from "./sources/index.mjs";

const root = new URL("../", import.meta.url);
const { stores } = JSON.parse(await readFile(new URL("stores.json", root), "utf8"));
const now = new Date();
const from = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);

let previous = { deals: [] };
try { previous = JSON.parse(await readFile(new URL("deals.json", root), "utf8")); } catch {}

const out = { updatedAt: now.toISOString(), stores: [], deals: [], errors: [] };
for (const store of stores) {
  const src = sources[store.source];
  if (!src) { out.errors.push({ store: store.id, message: `読み取り方法 "${store.source}" がありません` }); continue; }
  try {
    const { deals, sourceUrl } = await src.fetchDeals(store, { now });
    out.stores.push({ id: store.id, name: store.name, url: sourceUrl, count: deals.length });
    for (const d of deals) out.deals.push({ store: store.id, storeName: store.name, ...d });
    console.log(`${store.name}: ${deals.length} 件`);
  } catch (e) {
    // 読み取りに失敗したお店は前回の情報を残す
    console.error(`${store.name}: ${e.message}`);
    out.errors.push({ store: store.id, message: String(e.message || e) });
    out.stores.push({ id: store.id, name: store.name, count: 0, error: true });
    for (const d of previous.deals || []) if (d.store === store.id) out.deals.push(d);
  }
}
const seen = new Set();
out.deals = out.deals
  .filter((d) => d.date >= from)
  .filter((d) => { const k = d.store + d.date + d.title; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => a.date.localeCompare(b.date) || a.storeName.localeCompare(b.storeName));

// 中身が変わっていなければ書き換えない（無駄なコミットを避ける）
const strip = (o) => JSON.stringify({ ...o, updatedAt: null });
if (strip(out) !== strip(previous)) {
  await writeFile(new URL("deals.json", root), JSON.stringify(out, null, 1) + "\n");
  console.log("deals.json を更新しました");
} else console.log("変更なし");
if (out.errors.length && out.errors.length === stores.length) process.exitCode = 1;
