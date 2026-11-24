// 各お店の読み取りで使う共通の道具

export async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "kaimono-memo deals fetcher (personal use)", "Accept-Language": "ja" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.text();
}

// HTML を行ごとのプレーンテキストにする（全角英数・全角スペース・～ は半角にそろえる）
export function htmlToLines(html) {
  const text = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return text.normalize("NFKC").split(/\n+/).map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
}

// 絵文字や記号を前後から取り除く
export function tidy(s) {
  return s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}★☆◆◇■□●○◎※♪!！]+/gu, " ").replace(/\s+/g, " ").trim();
}

export const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// 「13(金)14(土)15(日)」「6(金)~8(日)」「2・16・23日」などから日にちの配列を取り出す
export function parseDays(part) {
  const days = new Set();
  let rest = part.replace(/(\d{1,2})\s*日?\s*(?:\([^)]{1,3}\)\s*)*[~〜\-–]\s*(\d{1,2})/g, (_, a, b) => {
    a = Number(a); b = Number(b);
    if (a >= 1 && b <= 31 && a <= b) for (let d = a; d <= b; d++) days.add(d);
    return " ";
  });
  for (const m of rest.matchAll(/\d{1,2}/g)) { const d = Number(m[0]); if (d >= 1 && d <= 31) days.add(d); }
  return [...days].sort((a, b) => a - b);
}

// 1行を「内容」と「日にち」に分ける。日にちが行の終わりにまとまっている形を想定
const DATE_TAIL = /^(.*?[^\d\s・,、.])\s*((?:\d{1,2}\s*日?\s*(?:\([月火水木金土日祝各・\s]{1,4}\)\s*)*[~〜\-–・,、.\s]*)+)$/u;
export function splitLabelDays(line) {
  const t = tidy(line);
  const m = t.match(DATE_TAIL);
  if (!m) return null;
  const label = m[1].trim(), days = parseDays(m[2]);
  if (!label || days.length === 0) return null;
  return { label, days };
}

// お得日らしい内容か（あいさつ文などを除く）
export const looksLikeDeal = (s) => /倍|ポイント|祭|セール|割引|%\s*OFF|円引|お得|特売|ST|販促|ボーナス/i.test(s);
