/* ============================================================
   collect_longform.js — 워크플로가 지은 긴 글을 한 파일로 모은다.

   에이전트마다 결과가 journal.jsonl 에 한 줄씩 남는다. 라벨이 아니라
   내용의 모양(어떤 키를 가졌는지)으로 갈래를 나눈다 —
   라벨은 워크플로를 고칠 때마다 바뀌지만 스키마는 안 바뀌기 때문이다.

   쓰는 법:  node tools/collect_longform.js <journal.jsonl 경로>
   ============================================================ */
'use strict';
const fs = require('fs');

const path = process.argv[2];
if (!path) { console.error('journal.jsonl 경로를 달라'); process.exit(1); }

const out = { personas: [], natures: [], today: [], daeun: [], audits: [] };

for (const line of fs.readFileSync(path, 'utf8').trim().split('\n')) {
  let o;
  try { o = JSON.parse(line); } catch { continue; }
  if (o.type !== 'result') continue;
  const r = o.result;
  if (!r || typeof r !== 'object') continue;

  if (Array.isArray(r.personas)) { out.personas.push(...r.personas); continue; }
  if (r.verdict) { out.audits.push(r); continue; }
  if (!Array.isArray(r.entries) || !r.entries.length) continue;

  const e = r.entries[0];
  if ('season' in e) out.natures.push(...r.entries);
  else if ('relation' in e) out.today.push(...r.entries);
  else if ('key' in e) out.daeun.push(...r.entries);
}

/* 기질은 일간×계절이 열쇠다. 에이전트 다섯이 나눠 쓰다 보니 겹치는 조합이 나온다.
   먼저 쓴 것을 살리고 뒤엣것을 버린다 — 순서가 그대로 워크플로 순서라 재현된다. */
const seen = new Set();
out.natures = out.natures.filter((n) => {
  const k = n.stem + n.season;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const SEASONS = ['봄', '여름', '가을', '겨울'];
const missing = [];
for (const s of STEMS) for (const se of SEASONS) if (!seen.has(s + se)) missing.push(s + se);

fs.writeFileSync('tools/longform_source.json', JSON.stringify(out, null, 1), 'utf8');

const words = (arr, f) => arr.reduce((a, x) => a + (f(x) || []).join('').length, 0);
console.log('  물상   ' + out.personas.length + '개');
console.log('  기질   ' + out.natures.length + '/40장   ' + words(out.natures, (x) => x.paras) + '자');
console.log('  오늘   ' + out.today.length + '/10장   ' + words(out.today, (x) => x.paras) + '자');
console.log('  대운   ' + out.daeun.length + '/10장   ' + words(out.daeun, (x) => x.paras) + '자');
if (missing.length) console.log('  빠진 조합: ' + missing.join(' '));
for (const a of out.audits) console.log('  검수   ' + a.verdict + ' — ' + a.issues.length + '건');
