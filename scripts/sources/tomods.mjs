// トモズ：各店舗の「お知らせ」から、イベントカレンダーと期間限定キャンペーンを読み取る
// 一覧: https://shop.tomods.jp/detail/{shopId}/notice/
import { fetchText, htmlToLines, tidy, ymd, splitLabelDays, splitDaysLabel, looksLikeDeal } from "./common.mjs";

const BASE = "https://shop.tomods.jp";

// お知らせ一覧から {id, date, title, url} を取り出す
export function parseNoticeList(html, shopId) {
  const out = [];
  const re = new RegExp(`<a[^>]+href="(?:${BASE})?/detail/${shopId}/notice/(\\d+)/?"[^>]*>([\\s\\S]*?)</a>`, "g");
  for (const m of html.matchAll(re)) {
    const text = htmlToLines(m[2]).join(" ");
    const dm = text.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    const title = text.replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/, "").trim();
    if (!title) continue;
    out.push({ id: m[1], posted: dm ? ymd(dm[1], dm[2], dm[3]) : null, title, url: `${BASE}/detail/${shopId}/notice/${m[1]}/` });
  }
  // 同じお知らせへのリンクが複数あるときは、情報が多いほうを残す
  const byId = new Map();
  for (const n of out) { const p = byId.get(n.id); if (!p || (!p.posted && n.posted)) byId.set(n.id, n); }
  return [...byId.values()];
}

// 「11月イベントカレンダー」の本文 → お得日の配列
export function parseCalendar(lines, year, month) {
  const deals = [];
  for (const line of lines) {
    // 店舗によって「内容 → 日にち」と「【日にち】 内容」の2通りの書き方がある
    const r = splitLabelDays(line) || splitDaysLabel(line);
    if (!r || !looksLikeDeal(r.label)) continue;
    for (const d of r.days) deals.push({ date: ymd(year, month, d), title: r.label });
  }
  return deals;
}

// タイトルに「11/25~11/29」「12/1」のような期間があるキャンペーン
export function parseCampaignTitle(title, postedYear) {
  const t = title.normalize("NFKC");
  const range = t.match(/(\d{1,2})\/(\d{1,2})\s*(?:\([^)]*\))?\s*[~〜\-–]\s*(?:(\d{1,2})\/)?(\d{1,2})/);
  const single = !range && t.match(/(\d{1,2})\/(\d{1,2})/);
  if (!range && !single) return [];
  const label = tidy(t.replace(range ? range[0] : single[0], "").replace(/限定|開催|のお知らせ/g, " ")).replace(/^[\s!！・:：]+/, "");
  if (!looksLikeDeal(label)) return [];
  const dates = [];
  if (range) {
    const m1 = Number(range[1]), d1 = Number(range[2]), m2 = range[3] ? Number(range[3]) : m1, d2 = Number(range[4]);
    const start = new Date(Date.UTC(postedYear, m1 - 1, d1));
    let end = new Date(Date.UTC(postedYear + (m2 < m1 ? 1 : 0), m2 - 1, d2));
    for (let t2 = start; t2 <= end && dates.length < 31; t2 = new Date(t2.getTime() + 86400000))
      dates.push(ymd(t2.getUTCFullYear(), t2.getUTCMonth() + 1, t2.getUTCDate()));
  } else dates.push(ymd(postedYear, Number(single[1]), Number(single[2])));
  return dates.map((date) => ({ date, title: label }));
}

export async function fetchDeals(store, { now = new Date(), get = fetchText } = {}) {
  const listUrl = `${BASE}/detail/${store.shopId}/notice/`;
  const notices = parseNoticeList(await get(listUrl), store.shopId);
  const cutoff = new Date(now.getTime() - 70 * 86400000).toISOString().slice(0, 10);
  const deals = [];
  for (const n of notices) {
    if (n.posted && n.posted < cutoff) continue;
    const postedYear = Number((n.posted || now.toISOString()).slice(0, 4));
    const postedMonth = Number((n.posted || now.toISOString()).slice(5, 7));
    const cal = n.title.normalize("NFKC").match(/(\d{1,2})\s*月.*カレンダー/);
    if (cal) {
      const month = Number(cal[1]);
      const year = month < postedMonth ? postedYear + 1 : postedYear;
      const lines = htmlToLines(await get(n.url));
      const found = parseCalendar(lines, year, month);
      console.log(`  [カレンダー] ${n.posted} ${n.title}: ${found.length} 件`);
      if (!found.length) console.log(lines.slice(0, 60).map((l) => "    | " + l).join("\n"));
      for (const d of found) deals.push({ ...d, url: n.url });
      continue;
    }
    const found = parseCampaignTitle(n.title, postedYear);
    console.log(`  [お知らせ] ${n.posted} ${n.title}: ${found.length} 件`);
    for (const d of found) deals.push({ ...d, url: n.url });
  }
  return { deals, sourceUrl: listUrl };
}
