// トモズ読み取りのテスト（node --test scripts/test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNoticeList, parseCalendar, parseCampaignTitle, fetchDeals } from "../sources/tomods.mjs";
import { htmlToLines, splitLabelDays } from "../sources/common.mjs";

const LIST = `<ul>
<li><a href="/detail/137/notice/2021347/"><span>2026.11.24</span><p>🔥11/25～11/29限定！全品10倍＆対象商品最大60倍！超ポイント祭り🔥</p></a></li>
<li><a href="https://shop.tomods.jp/detail/137/notice/1973813/"><span>2026.10.31</span><p>１１月イベントカレンダー</p></a></li>
<li><a href="/detail/137/notice/1584888/"><span>2026.02.16</span><p>2月のオススメ商品</p></a></li>
</ul>`;
const CAL = `<div><p>いつもトモズ八王子店をご利用いただきありがとうございます。<br>11月1日は紅茶の日です☕</p>
<p>🍠dポイントorポンタ10倍　　　　　　　13(金)14(土)15(日)🍠<br>
🍠ST10倍・化粧品15倍　　　　　　6(金)～8(日)🍠<br>
🍠ST5倍　　　　　　　　　　　　2・16・23(各)(月)🍠<br>
🍠超ST祭り　　　　　　　　　　　25(水)～29(日)🍠</p></div>`;

test("一覧からお知らせを取り出す", () => {
  const n = parseNoticeList(LIST, 137);
  assert.equal(n.length, 3);
  assert.equal(n[1].posted, "2026-10-31");
  assert.match(n[1].title, /イベントカレンダー/);
});

test("1行を内容と日にちに分ける", () => {
  assert.deepEqual(splitLabelDays("🍠ST10倍・化粧品15倍　　　　　　6(金)～8(日)🍠".normalize("NFKC")), { label: "ST10倍・化粧品15倍", days: [6, 7, 8] });
  assert.deepEqual(splitLabelDays("dポイントorポンタ10倍 13(金)14(土)15(日)"), { label: "dポイントorポンタ10倍", days: [13, 14, 15] });
  assert.equal(splitLabelDays("11月1日は紅茶の日です"), null);
});

test("カレンダー本文からお得日を作る", () => {
  const d = parseCalendar(htmlToLines(CAL), 2026, 11);
  const by = (t) => d.filter((x) => x.title === t).map((x) => x.date);
  assert.deepEqual(by("dポイントorポンタ10倍"), ["2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.deepEqual(by("ST5倍"), ["2026-11-02", "2026-11-16", "2026-11-23"]);
  assert.deepEqual(by("超ST祭り"), ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
  assert.ok(!d.some((x) => /紅茶/.test(x.title)));
});

test("タイトルの期間からキャンペーンを作る", () => {
  const d = parseCampaignTitle("🔥11/25～11/29限定！全品10倍＆対象商品最大60倍！超ポイント祭り🔥", 2026);
  assert.equal(d.length, 5);
  assert.match(d[0].title, /全品10倍/);
  assert.deepEqual(parseCampaignTitle("2月のオススメ商品", 2026), []);
  assert.equal(parseCampaignTitle("12/30~1/3 ポイント5倍", 2026).at(-1).date, "2027-01-03");
});

test("年またぎのカレンダー（12月投稿の1月カレンダー）", async () => {
  const list = `<a href="/detail/1/notice/9/"><span>2026.12.30</span><p>1月イベントカレンダー</p></a>`;
  const body = `<p>ST10倍 5(月)</p>`;
  const r = await fetchDeals({ shopId: 1 }, { now: new Date("2026-12-31T00:00:00Z"), get: async (u) => (u.endsWith("/notice/") ? list : body) });
  assert.deepEqual(r.deals.map((x) => x.date), ["2027-01-05"]);
});
