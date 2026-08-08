/* ============================================================
   measure_wealth.js — 재물 이야기를 가를 축이 실제로 고르게 나뉘는지 잰다.

   왜 재나.
   "재성이 많다/적다" 같은 구간을 눈대중으로 정하면 대부분이 한 칸에 몰린다.
   그러면 열 사람 중 아홉이 같은 글을 읽는다 — 조합해서 만든 티가 바로 난다.
   강약 구간을 정할 때 실측으로 잡았던 것과 같은 방법이다.

   무엇을 재나. 명리에서 재물을 볼 때 실제로 쓰는 다섯 가지다.
     ① 재성이 얼마나 있나            — 벌 그릇의 크기
     ② 편재냐 정재냐                 — 큰 판을 벌이나, 차곡차곡 쌓나
     ③ 식상이 재성을 밀어주나(식상생재) — 만들어서 버나, 그냥 들어오나
     ④ 비겁이 재성보다 센가(비겁쟁재)   — 들어온 걸 나눠 갖게 되나
     ⑤ 일간이 그 재물을 감당하나       — 신약한데 재성만 크면 오히려 짐이 된다

   쓰는 법:  node tools/measure_wealth.js [표본수]
   ============================================================ */
'use strict';
const M = require('../js/manseryeok.js');
const R = require('../js/report.js');

const N = Number(process.argv[2]) || 20000;

/* 재현 가능한 난수. 같은 씨앗이면 같은 표본이 나와야 다시 재도 같은 답이다. */
function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function sample(n) {
  const r = rand(20260809);
  const out = [];
  for (let i = 0; i < n; i++) {
    // 1930~2010년생. 실제 사용자 분포에 가깝게 넓게 잡는다.
    const year = 1930 + Math.floor(r() * 81);
    const month = 1 + Math.floor(r() * 12);
    const day = 1 + Math.floor(r() * 28);
    const hour = Math.floor(r() * 24);
    const minute = Math.floor(r() * 60);
    try {
      out.push(M.compute({ year, month, day, hour, minute,
        gender: r() < 0.5 ? 'M' : 'F', useTrueSolar: false }));
    } catch (e) { /* 계산이 안 되는 날짜는 건너뛴다 */ }
  }
  return out;
}

/* 재성 안에서 편재와 정재가 각각 얼마나 되는지.
   groupShares 는 다섯 묶음까지만 주므로 여기서 한 칸 더 들어간다. */
function jaeSplit(chart) {
  const P = chart.pillars;
  let pyeon = 0, jeong = 0;
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = P[k];
    if (!p) continue;
    for (const s of [p.stemSipseong, p.branchSipseong]) {
      if (s === '편재') pyeon++;
      else if (s === '정재') jeong++;
    }
  }
  return { pyeon, jeong };
}

const charts = sample(N);
const rows = charts.map((c) => {
  const g = R.groupShares(c);
  const st = R.strength(c);
  const js = jaeSplit(c);
  return {
    jae: g.재성,
    sik: g.식상,
    bi: g.비겁,
    strong: st.label,
    // 비겁이 재성보다 세면 들어온 것을 나눠 갖는 모양이 된다
    contest: g.비겁 > g.재성,
    // 식상이 재성을 밀어주는가 — 만들어서 버는 쪽인지
    feeds: g.식상 >= 0.10,
    kind: js.pyeon > js.jeong ? '편재' : js.jeong > js.pyeon ? '정재' : (js.pyeon ? '섞임' : '없음'),
  };
});

const q = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
};

const jae = rows.map((r) => r.jae);
console.log(`표본 ${rows.length}개\n`);

console.log('① 재성 세력 분위수');
for (const p of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
  console.log(`   상위 ${String(Math.round((1 - p) * 100)).padStart(3)}%  ${(q(jae, p) * 100).toFixed(1)}%`);
}
/* 셋으로 가른다. 삼등분이면 어느 칸에도 3분의 1씩 들어온다. */
const CUT_LO = q(jae, 1 / 3), CUT_HI = q(jae, 2 / 3);
console.log(`   → 구간: 적음 < ${(CUT_LO * 100).toFixed(1)}% ≤ 보통 < ${(CUT_HI * 100).toFixed(1)}% ≤ 많음`);

const band = (v) => (v < CUT_LO ? '적음' : v < CUT_HI ? '보통' : '많음');
const tally = (f) => {
  const m = {};
  rows.forEach((r) => { const k = f(r); m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(v / rows.length * 100).toFixed(1)}%`).join('  ');
};

console.log(`\n② 편재냐 정재냐    ${tally((r) => r.kind)}`);
console.log(`③ 식상이 밀어주나  ${tally((r) => (r.feeds ? '밀어줌' : '약함'))}`);
console.log(`④ 비겁이 더 센가   ${tally((r) => (r.contest ? '나눠 갖는 모양' : '아님'))}`);
console.log(`⑤ 일간 강약        ${tally((r) => r.strong)}`);
console.log(`\n재성 세 칸        ${tally((r) => band(r.jae))}`);

/* 실제로 쓸 조합이 몇 개나 되고, 가장 큰 칸에 몇 명이 몰리는지.
   한 칸이 30%를 넘으면 그 글을 세 명 중 한 명이 읽는다는 뜻이라 축을 더 갈라야 한다. */
const key = (r) => `${band(r.jae)}·${r.kind}·${r.feeds ? '생재' : '무생'}·${r.contest ? '쟁재' : '독점'}`;
const combo = {};
rows.forEach((r) => { const k = key(r); combo[k] = (combo[k] || 0) + 1; });
const sorted = Object.entries(combo).sort((a, b) => b[1] - a[1]);
console.log(`\n조합 ${sorted.length}가지 — 가장 큰 칸 ${(sorted[0][1] / rows.length * 100).toFixed(1)}%`);
console.log('   많이 몰리는 칸 5개');
sorted.slice(0, 5).forEach(([k, v]) =>
  console.log(`     ${k.padEnd(26)} ${(v / rows.length * 100).toFixed(1)}%`));
const tiny = sorted.filter(([, v]) => v / rows.length < 0.005).length;
console.log(`   0.5% 미만인 칸 ${tiny}개 — 이런 칸은 글을 따로 안 쓰고 이웃 칸으로 보낸다`);
