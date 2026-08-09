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

   hiddenFace 만 "같음-/다름-" 접두어가 붙어 열쇠로 바로 잡힌다.
   나머지 다섯은 열쇠가 겹친다 — 십성 열 개짜리가 둘, 다섯 묶음짜리가 셋.

   처음엔 **온 순서**로 갈랐는데 틀렸다. 워크플로가 parallel 로 돌아서
   끝나는 순서가 JOBS 순서와 다르다. friction 자리에 올해 일 글이 들어가 있었고,
   빌드 손질이 "못 찾음" 을 띄워 준 덕에 알았다.

   그래서 **글 안에 있는 말**로 가른다. 순서에 기대지 않으니 다시 돌려도 같은 답이 나온다.
     대운·다음간지  → turning     열 해마다 바뀌는 흐름
     세운·올해간지  → yearWork    한 해마다 바뀌는 흐름
     둘 다 없으면   → friction    부딪히는 자리
     월지·사회궁    → firstLook   밖에서 남이 먼저 읽는 자리
     일지·가까운    → beside      내가 누구 옆에서 편한가 */
const pools = [];

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
  pools.push(r.entries);
}

/* 글 안의 말로 갈래를 정한다. 순서에 안 기댄다. */
const textOf = (es) => es.flatMap((x) => [x.title, x.lead, ...(x.paras || [])]).join(' ');
const hits = (es, re) => (textOf(es).match(re) || []).length;

for (const es of pools) {
  const n = es.length;
  if (n === 10) {
    // 첫인상은 월지(사회궁), 곁에 둘 사람은 일지(가장 가까운 자리)를 말한다.
    const near = hits(es, /가까운|곁|일지|같이 있|옆에/g);
    const out9 = hits(es, /밖에서|처음 보|첫인상|월지|사회/g);
    if (near > out9) out.beside = es; else out.firstLook = es;
    continue;
  }
  if (n === 5) {
    const dae = hits(es, /대운|열 해|십 년|다음간지/g);
    const se = hits(es, /세운|올해|한 해마다/g);
    if (dae > se) out.turning = es;
    else if (se > 0) out.yearWork = es;
    else out.friction = es;
  }
}
// 다섯 묶음 셋 중 아직 안 채워진 자리가 있으면 남은 것을 넣는다.
for (const es of pools) {
  if (es.length !== 5) continue;
  if (out.turning === es || out.yearWork === es || out.friction === es) continue;
  if (!out.friction.length) out.friction = es;
  else if (!out.turning.length) out.turning = es;
  else if (!out.yearWork.length) out.yearWork = es;
}

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
