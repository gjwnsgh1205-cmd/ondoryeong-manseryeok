/* ============================================================
   collect_six.js — 워크플로가 지은 여섯 주제 45편을 한 파일로 모은다.

   묶음을 라벨이 아니라 **열쇠의 모양**으로 가른다.
   라벨은 워크플로를 고칠 때마다 바뀌지만 열쇠는 안 바뀌기 때문이다.

   쓰는 법:  node tools/collect_six.js <journal.jsonl 경로>
   ============================================================ */
'use strict';
const fs = require('fs');

const path = process.argv[2];
if (!path) { console.error('journal.jsonl 경로를 달라'); process.exit(1); }

const SIP = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
const GRP = ['비겁', '식상', '재성', '관성', '인성'];

const WANT = {
  hiddenFace: GRP.flatMap((g) => [`같음-${g}`, `다름-${g}`]),
  firstLook: SIP,
  beside: SIP,
  friction: GRP,
  turning: GRP,
  yearWork: GRP,
};

const out = { hiddenFace: [], firstLook: [], beside: [], friction: [], turning: [], yearWork: [], audits: [] };

/* 묶음을 알아내는 법.
   hiddenFace 만 "같음-/다름-" 접두어가 붙어 바로 잡힌다.
   firstLook 과 beside 는 열쇠가 똑같이 십성 열 개다 — 열쇠로는 못 가른다.
   그래서 **먼저 온 십성 묶음이 firstLook, 다음이 beside** 로 둔다(워크플로 순서 그대로).
   friction·turning·yearWork 도 다섯 묶음이 같아서 온 순서로 가른다. */
const sipSeen = [];
const grpSeen = [];

for (const line of fs.readFileSync(path, 'utf8').trim().split('\n')) {
  let o;
  try { o = JSON.parse(line); } catch { continue; }
  if (o.type !== 'result') continue;
  const r = o.result;
  if (!r || typeof r !== 'object') continue;
  if (r.verdict) { out.audits.push(r); continue; }
  if (!Array.isArray(r.entries) || !r.entries.length) continue;

  const keys = r.entries.map((x) => x.key);
  if (keys.some((k) => /^(같음|다름)-/.test(k))) { out.hiddenFace = r.entries; continue; }
  if (keys.length === 10) { sipSeen.push(r.entries); continue; }
  if (keys.length === 5) { grpSeen.push(r.entries); continue; }
}

// 워크플로가 JOBS 순서대로 돌려주므로 그 순서로 배정한다.
[out.firstLook, out.beside] = [sipSeen[0] || [], sipSeen[1] || []];
[out.friction, out.turning, out.yearWork] = [grpSeen[0] || [], grpSeen[1] || [], grpSeen[2] || []];

fs.writeFileSync('tools/six_source.json', JSON.stringify(out, null, 1), 'utf8');

let total = 0;
for (const [id, want] of Object.entries(WANT)) {
  const got = out[id];
  const have = new Set(got.map((x) => x.key));
  const miss = want.filter((k) => !have.has(k));
  const chars = got.reduce((a, x) => a + (x.paras || []).join('').length, 0);
  total += got.length;
  console.log(`  ${id.padEnd(11)} ${String(got.length).padStart(2)}/${want.length}  ${String(chars).padStart(5)}자${miss.length ? '   ! 빠짐: ' + miss.join(' ') : ''}`);
}
console.log(`  합계 ${total}/45편`);
for (const a of out.audits) console.log(`  검수 ${a.verdict} — ${a.issues.length}건`);
