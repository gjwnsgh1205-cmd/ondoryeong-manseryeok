/* ============================================================
   measure_name.js — 이름을 적은 사람이 화면에서 이름을 몇 번이나 보는지 잰다.

   왜 재나.
   글 129편 중 45편이 "{이름}님은" 으로 연다. 그런데 한 사람이 한 화면에서 보는 건
   묶음마다 **한 편씩**이다. 그러니 편별 비율이 아니라
   **명식별로 몇 번 만나는지**를 재야 진짜 값이 나온다.

   묶음마다 들쭉날쭉하면 어떤 사람은 다섯 번 보고 어떤 사람은 한 번도 못 본다.
   이름을 받아놓고 안 부르면 받은 보람이 없다.

   쓰는 법:  node tools/measure_name.js [표본수]
   ============================================================ */
'use strict';
/* report.js 는 Content 를 **전역**에서 찾는다(브라우저에 그렇게 실려서다).
   require 만 하면 전역에 안 붙어서 대운 글이 통째로 null 로 나온다.
   실제로 한 번 속아서 "인생 흐름 20%" 라는 틀린 수치를 봤다.
   전역에 먼저 붙이고 report 를 불러온다. */
const M = require('../js/manseryeok.js');
const C = require('../js/content.js');
global.Content = C;
global.Manse = M;
const R = require('../js/report.js');

const N = Number(process.argv[2]) || 3000;

function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* 명식 하나가 실제로 보는 편들. 화면 구성 그대로다. */
function shown(rp) {
  const lf = C.longform;
  const t = rp.type;
  const pick = (box, key) => (box && key && lf[box] ? lf[box][key] : null);
  const cur = rp.curve && rp.curve[rp.current.idx];
  return [
    ['타고난 성격', pick('natures', t.stem + t.season)],
    ['타고난 성격', pick('hiddenFace', rp.hiddenFace && rp.hiddenFace.key)],
    ['타고난 성격', pick('firstLook', rp.firstLook && rp.firstLook.key)],
    ['타고난 성격', pick('beside', rp.beside && rp.beside.key)],
    ['타고난 성격', pick('friction', rp.friction && rp.friction.key)],
    ['사주팔자', pick('wealth', rp.wealth && rp.wealth.key)],
    ['사주팔자', pick('work', rp.work && rp.work.key)],
    ['사주팔자', pick('yearWork', rp.yearWork && rp.yearWork.key)],
    ['인생 흐름', cur && cur.chapter],
    ['인생 흐름', pick('turning', rp.turning && rp.turning.key)],
    ['오늘의 운수', pick('today', rp.today && rp.today.relation)],
  ];
}

const r = rand(20260809);
const rows = [];
for (let i = 0; i < N; i++) {
  const year = 1940 + Math.floor(r() * 71);
  try {
    const c = M.compute({
      year, month: 1 + Math.floor(r() * 12), day: 1 + Math.floor(r() * 28),
      hour: Math.floor(r() * 24), minute: Math.floor(r() * 60),
      gender: r() < 0.5 ? 'M' : 'F', useTrueSolar: false,
    });
    const rp = R.build(c, { unlocked: false });
    const tabs = {};
    let total = 0;
    for (const [tab, ch] of shown(rp)) {
      if (!ch) continue;
      // 무료로 열리는 문단만 센다. 잠긴 데 있는 이름은 안 보인다.
      const free = (ch.paras || []).slice(0, ch.cutAt || 2).join(' ');
      const n = (free.match(/\{이름\}/g) || []).length;
      if (n) { tabs[tab] = (tabs[tab] || 0) + n; total += n; }
    }
    rows.push({ total, tabs });
  } catch (e) { /* 계산이 안 되는 날짜는 건너뛴다 */ }
}

const tally = (f) => {
  const m = {};
  rows.forEach((x) => { const k = f(x); m[k] = (m[k] || 0) + 1; });
  return m;
};

console.log(`표본 ${rows.length}개 — 무료 구간에서 이름을 만나는 횟수\n`);

const byTotal = tally((x) => Math.min(x.total, 5));
for (const k of Object.keys(byTotal).sort((a, b) => a - b)) {
  const pct = (byTotal[k] / rows.length * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`  ${k === '5' ? '5회 이상' : `${k}회     `}  ${String(pct).padStart(5)}%  ${bar}`);
}

const none = (byTotal['0'] || 0) / rows.length * 100;
console.log(`\n  이름을 한 번도 못 보는 사람: ${none.toFixed(1)}%`);

console.log('\n탭마다 이름을 보는 사람의 비율');
for (const tab of ['타고난 성격', '사주팔자', '인생 흐름', '오늘의 운수']) {
  const hit = rows.filter((x) => x.tabs[tab]).length / rows.length * 100;
  console.log(`  ${tab.padEnd(7)} ${hit.toFixed(1)}%`);
}
