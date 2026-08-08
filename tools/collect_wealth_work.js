/* ============================================================
   collect_wealth_work.js — 워크플로가 지은 재물·일 글을 한 파일로 모은다.

   에이전트마다 결과가 journal.jsonl 에 한 줄씩 남는다.
   라벨이 아니라 **내용의 모양**으로 갈래를 나눈다 — 라벨은 워크플로를 고칠 때마다
   바뀌지만 스키마는 안 바뀌기 때문이다.

   쓰는 법:  node tools/collect_wealth_work.js <journal.jsonl 경로>
   ============================================================ */
'use strict';
const fs = require('fs');

const path = process.argv[2];
if (!path) { console.error('journal.jsonl 경로를 달라'); process.exit(1); }

const out = { wealth: [], work: [], addons: null, audits: [] };

for (const line of fs.readFileSync(path, 'utf8').trim().split('\n')) {
  let o;
  try { o = JSON.parse(line); } catch { continue; }
  if (o.type !== 'result') continue;
  const r = o.result;
  if (!r || typeof r !== 'object') continue;

  if (r.verdict) { out.audits.push(r); continue; }
  if (r.feeds && r.contest) { out.addons = r; continue; }
  if (!Array.isArray(r.entries) || !r.entries.length) continue;

  // 재물의 key 는 "밴드-종류", 일의 key 는 "lean-field" 다. 종류 이름으로 가른다.
  const k = r.entries[0].key || '';
  if (/^(적음|보통|많음)-/.test(k)) out.wealth.push(...r.entries);
  else out.work.push(...r.entries);
}

/* 겹치면 먼저 쓴 것을 살린다 — 순서가 워크플로 순서라 다시 돌려도 같은 답이 나온다. */
const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
};
out.wealth = dedupe(out.wealth);
out.work = dedupe(out.work);

/* 있어야 할 열쇠가 다 있는지. 하나라도 빠지면 그 명식인 사람은 빈 화면을 본다. */
const WANT_W = [];
for (const b of ['적음', '보통', '많음']) for (const k of ['편재', '정재', '없음']) WANT_W.push(`${b}-${k}`);
const WANT_K = [];
for (const l of ['만드는 쪽', '맡는 쪽', '반반']) for (const f of ['비겁', '식상', '재성', '관성', '인성']) WANT_K.push(`${l}-${f}`);

const have = (arr) => new Set(arr.map((x) => x.key));
const missW = WANT_W.filter((k) => !have(out.wealth).has(k));
const missK = WANT_K.filter((k) => !have(out.work).has(k));

fs.writeFileSync('tools/wealth_work_source.json', JSON.stringify(out, null, 1), 'utf8');

const chars = (arr) => arr.reduce((a, x) => a + (x.paras || []).join('').length, 0);
console.log(`  재물 ${out.wealth.length}/9   ${chars(out.wealth)}자`);
console.log(`  일   ${out.work.length}/15  ${chars(out.work)}자`);
console.log(`  조건 문단 ${out.addons ? Object.keys(out.addons).length + '개' : '없음'}`);
if (missW.length) console.log(`  ! 재물 빠짐: ${missW.join(' ')}`);
if (missK.length) console.log(`  ! 일 빠짐: ${missK.join(' ')}`);
for (const a of out.audits) console.log(`  검수 ${a.verdict} — ${a.issues.length}건`);
