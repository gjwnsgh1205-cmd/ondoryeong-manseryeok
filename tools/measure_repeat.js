/* ============================================================
   measure_repeat.js — 한 사람이 "본 적 있는 오늘의 운"을 언제 다시 보는가.

   이 앱에서 사람이 매일 돌아올 이유는 오늘의 운 하나뿐이다.
   그런데 하루는 일진(그날의 간지)으로 정해지고, 일진은 60갑자를 돈다.
   그러니 축을 하나만 쓰면 정확히 60일마다 똑같은 하루가 돌아온다 — 두 달이면 들킨다.

   이 스크립트는 축을 하나씩 더할 때 반복 주기가 얼마나 늘어나는지 실제로 센다.
   숫자를 지어내지 않기 위해서다.

     node tools/measure_repeat.js               # 표본 8명 · 1500일
     node tools/measure_repeat.js 3000          # 날수 늘리기
   ============================================================ */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.Manse = require(path.join(ROOT, 'js/manseryeok.js'));
try { global.Manse.setAstro(require(path.join(ROOT, 'js/vendor/astronomy.browser.min.js'))); }
catch (e) { console.warn('※ astronomy-engine 없이 근사식으로 돈다.'); }
global.Content = require(path.join(ROOT, 'js/content.js'));
const Report = require(path.join(ROOT, 'js/report.js'));

const DAYS = parseInt(process.argv[2] || '1500', 10);

// 생일이 다르면 결과도 달라야 하니 여러 사람으로 잰다
const PEOPLE = [
  ['1993-04-21 19:05 여', { year: 1993, month: 4, day: 21, hour: 19, minute: 5, gender: 'F' }],
  ['1990-06-15 14:30 여', { year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: 'F' }],
  ['1988-11-03 07:20 남', { year: 1988, month: 11, day: 3, hour: 7, minute: 20, gender: 'M' }],
  ['1975-02-04 09:00 남', { year: 1975, month: 2, day: 4, hour: 9, minute: 0, gender: 'M' }],
  ['2001-12-31 23:50 여', { year: 2001, month: 12, day: 31, hour: 23, minute: 50, gender: 'F' }],
  ['1968-07-19 05:40 남', { year: 1968, month: 7, day: 19, hour: 5, minute: 40, gender: 'M' }],
  ['1999-09-09 12:00 여', { year: 1999, month: 9, day: 9, hour: 12, minute: 0, gender: 'F' }],
  ['1982-03-27 21:15 남', { year: 1982, month: 3, day: 27, hour: 21, minute: 15, gender: 'M' }],
];

// 축을 하나씩 더해 가며 잰다
const AXES = [
  ['일진만', (t, f) => `${t.relation}|${t.iljin.branchInfo.kor}|${t.kind}`],
  ['+ 이번 달', (t, f) => `${t.relation}|${t.iljin.branchInfo.kor}|${t.kind}|M${f.month.kor}`],
  ['+ 올해', (t, f) => `${t.relation}|${t.iljin.branchInfo.kor}|${t.kind}|M${f.month.kor}|Y${f.year.relation}`],
  ['+ 대운', (t, f) => `${t.relation}|${t.iljin.branchInfo.kor}|${t.kind}|M${f.month.kor}|Y${f.year.relation}|D${f.daeun ? f.daeun.ganji : '-'}`],
];

function measure(chart) {
  const keys = AXES.map(() => []);
  for (let i = 0; i < DAYS; i++) {
    const when = new Date(Date.UTC(2026, 0, 1 + i, 3, 0));
    const t = Report.todayLuck(chart, when);
    const f = Report.flow(chart, when, Report.currentPoint(
      Report.luckCurve(chart), Report.ageMonthsNow(chart, when)));
    AXES.forEach(([, fn], a) => keys[a].push(fn(t, f)));
  }
  return AXES.map((_, a) => {
    const seen = new Map();
    let first = null;
    keys[a].forEach((k, i) => {
      if (seen.has(k)) { if (first === null) first = i; }
      else seen.set(k, i);
    });
    return { distinct: seen.size, firstRepeat: first };
  });
}

function main() {
  console.log(`표본 ${PEOPLE.length}명 · ${DAYS}일 (2026-01-01 부터)\n`);
  const head = '사람'.padEnd(22) + AXES.map(([n]) => n.padStart(12)).join('');
  console.log(head);
  console.log('─'.repeat(head.length));

  const agg = AXES.map(() => ({ distinct: [], first: [] }));
  for (const [name, inp] of PEOPLE) {
    let chart;
    try {
      chart = Manse.compute({ ...inp, unknownTime: false, useTrueSolar: true });
    } catch (e) { console.log(`${name.padEnd(22)} (계산 불가: ${e.message})`); continue; }
    const rows = measure(chart);
    console.log(name.padEnd(22) + rows.map((r) => {
      agg[rows.indexOf(r)] && 0;
      return String(r.firstRepeat === null ? '반복없음' : r.firstRepeat + '일').padStart(12);
    }).join(''));
    rows.forEach((r, a) => {
      agg[a].distinct.push(r.distinct);
      agg[a].first.push(r.firstRepeat === null ? DAYS : r.firstRepeat);
    });
  }

  console.log('\n첫 반복까지 걸린 날 (평균)');
  AXES.forEach(([n], a) => {
    const f = agg[a].first;
    const d = agg[a].distinct;
    const avgF = Math.round(f.reduce((x, y) => x + y, 0) / f.length);
    const avgD = Math.round(d.reduce((x, y) => x + y, 0) / d.length);
    const note = avgF >= DAYS ? `${DAYS}일 안에 반복 없음` : `${avgF}일`;
    console.log(`  ${n.padEnd(12)} ${note.padStart(18)}   서로 다른 하루 ${avgD}가지`);
  });

  console.log('\n※ 일진만 쓰면 60일에서 걸린다. 이번 달과 올해를 얹어야 한 해를 넘긴다.');
}

main();
