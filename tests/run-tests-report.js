/* ============================================================
   run-tests-report.js — 리포트 계층 회귀 테스트
   manseryeok.js 는 tests/run-tests.js 가 따로 검증한다.
   여기서는 그 위에 얹은 것만 본다: 음력 변환, 유형 이름, 대운 곡선,
   오늘의 운, 챕터, 그리고 콘텐츠 DB에 구멍이 없는지.

     node tests/run-tests-report.js
   ============================================================ */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = (p) => require(path.join(ROOT, p));

global.Manse = R('js/manseryeok.js');
try { global.Manse.setAstro(R('js/vendor/astronomy.browser.min.js')); } catch (e) { /* 폴백으로 돈다 */ }
global.Content = R('js/content.js');
const Report = R('js/report.js');
const KLC = R('js/vendor/korean-lunar.min.js');

let pass = 0, fail = 0;
const group = (t) => console.log(`\n[${t}]`);
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const build = (o) => Report.build(global.Manse.compute({
  hour: 12, minute: 0, gender: 'F', unknownTime: false, useTrueSolar: true, ...o,
}));

/* ══════════════ 1. 음력 → 양력 ══════════════ */
group('1. 음력 변환');
{
  const C = KLC.default || KLC;
  const conv = (y, m, d, leap) => {
    const c = new C();
    if (!c.setLunarDate(y, m, d, !!leap)) return null;
    const s = c.getSolarCalendar();
    return `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
  };
  // 한국 설날은 공표된 날짜라 틀리면 바로 드러난다
  ok('음 1985-01-01 → 양 1985-02-20', conv(1985, 1, 1) === '1985-02-20', conv(1985, 1, 1));
  ok('음 2024-01-01 → 양 2024-02-10', conv(2024, 1, 1) === '2024-02-10', conv(2024, 1, 1));
  ok('음 2025-01-01 → 양 2025-01-29', conv(2025, 1, 1) === '2025-01-29', conv(2025, 1, 1));
  ok('윤2월 2023 → 양 2023-03-22', conv(2023, 2, 1, true) === '2023-03-22', conv(2023, 2, 1, true));
  ok('윤4월 2020 → 양 2020-05-23', conv(2020, 4, 1, true) === '2020-05-23', conv(2020, 4, 1, true));
  ok('경계 하단 1900-01-01', conv(1900, 1, 1) === '1900-01-31', conv(1900, 1, 1));
  ok('경계 상단 2050-01-01', conv(2050, 1, 1) === '2050-01-23', conv(2050, 1, 1));
  // 없는 윤달은 반드시 거부되어야 한다 — 조용히 평달로 넘어가면 남의 사주를 보여주게 된다
  ok('없는 윤달은 거부', conv(2024, 3, 1, true) === null, String(conv(2024, 3, 1, true)));
}

/* ══════════════ 2. 콘텐츠 DB에 구멍이 없는가 ══════════════ */
group('2. 콘텐츠 DB');
{
  const C = global.Content;
  const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const BR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const SEASONS = ['봄', '여름', '가을', '겨울'];
  const SIP = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];

  ok('일간 물상 10개', STEMS.every((s) => C.nouns[s] && C.nouns[s].noun && C.nouns[s].gloss));
  ok('월지 수식 12개', BR.every((b) => C.modifiers[b] && C.modifiers[b].modifier && C.modifiers[b].gloss));

  let holes = [];
  for (const s of STEMS) for (const se of SEASONS) {
    const d = C.defs[s + se];
    if (!d || !d.headline || !d.body || !d.strength || !d.caution) holes.push(s + se);
  }
  ok('기질 풀이 40개 빈칸 없음', holes.length === 0, holes.join(','));

  holes = [];
  for (const g of GROUPS) for (const t of ['왕', '약']) {
    const p = C.daeunPhases[`${g}-${t}`];
    if (!p || !p.label || !p.line || !p.advice) holes.push(`${g}-${t}`);
  }
  ok('대운 국면 10개 빈칸 없음', holes.length === 0, holes.join(','));

  // 오늘의 운은 이 앱의 유일한 재방문 장치라, 칸이 하나만 비어도 화면이 휑해진다
  const TD_FIELDS = ['mood', 'headline', 'why', 'work', 'people', 'body',
                     'doThis', 'avoid', 'watchFor', 'goodWith'];
  holes = [];
  SIP.forEach((r) => {
    const x = C.todayRelations[r];
    if (!x) { holes.push(r); return; }
    TD_FIELDS.forEach((f) => { if (!x[f]) holes.push(`${r}.${f}`); });
  });
  ok('오늘의 운 십성 10개 · 칸 10개 모두 참', holes.length === 0, holes.join(','));

  holes = [];
  BR.forEach((b) => {
    const x = C.todayBranches[b];
    if (!x) { holes.push(b); return; }
    ['air', 'bestTime', 'bestWhy'].forEach((f) => { if (!x[f]) holes.push(`${b}.${f}`); });
  });
  ok('오늘의 운 지지 12개 · 공기와 시간대', holes.length === 0, holes.join(','));

  holes = ['충', '육합', '삼합', '같음', '보통'].filter((k) => {
    const x = C.branchKinds && C.branchKinds[k];
    return !x || !x.label || !x.line || !x.tip;
  });
  ok('지지 관계 5종 빈칸 없음', holes.length === 0, holes.join(','));

  // 얇으면 매일 올 이유가 안 된다. 1판이 108자였다.
  const thin = SIP.filter((r) => TD_FIELDS.reduce((a, f) => a + (C.todayRelations[r][f] || '').length, 0) < 250);
  ok('오늘의 운이 항목마다 250자 이상', thin.length === 0, thin.join(','));

  // 기질 풀이에는 구체적인 장면이 하나씩 붙어야 한다
  const noEx = [];
  for (const st of STEMS) for (const se of SEASONS) {
    const d = C.defs[st + se];
    if (!d.example || d.example.length < 15) noEx.push(st + se);
  }
  ok('기질 40개에 예시가 붙어 있다', noEx.length === 0, noEx.join(','));

  ok('챕터 12개', Array.isArray(C.chapters) && C.chapters.length === 12);
  ok('무료 챕터 정확히 4개', C.chapters.filter((c) => c.free).length === 4);
  ok('잠긴 챕터는 모두 [ ] 를 가진다',
    C.chapters.filter((c) => !c.free).every((c) => /\[[^\]]+\]/.test(c.title)));

  // 단정·겁주기 표현이 다시 섞여 들어오면 여기서 잡는다
  const BANNED = ['반드시', '틀림없이', '어김없이', '무조건', '확실히'];
  const hits = [];
  (function walk(o, p) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') BANNED.forEach((b) => { if (v.includes(b)) hits.push(`${p}.${k}:${b}`); });
      else if (v && typeof v === 'object') walk(v, `${p}.${k}`);
    }
  })(C, '');
  ok('단정 금지어 없음', hits.length === 0, hits.join(', '));
}

/* ══════════════ 3. 유형 이름 ══════════════ */
group('3. 유형 이름');
{
  const C = global.Content;
  const names = new Set();
  for (const s of Object.keys(C.nouns)) for (const b of Object.keys(C.modifiers)) {
    names.add(`${C.modifiers[b].modifier} ${C.nouns[s].noun}`);
  }
  ok('120가지 조합', names.size === 120, `${names.size}가지`);
  ok('빈 이름 없음', [...names].every((n) => n.trim().length >= 4));

  const r = build({ year: 1990, month: 6, day: 15, hour: 14, minute: 30 });
  ok('명식에서 이름이 나온다', !!r.type.name && r.type.name.includes(' '), r.type.name);
  ok('이름이 일간 표기로 새지 않는다', !/일간$/.test(r.type.name), r.type.name);
}

/* ══════════════ 4. 대운 곡선 ══════════════ */
group('4. 대운 곡선');
{
  const r = build({ year: 1988, month: 11, day: 3, hour: 7, minute: 20, gender: 'M' });
  ok('구간이 이어붙는다', r.curve.every((p, i) =>
    i === 0 || p.startMonths === r.curve[i - 1].endMonths + 1));
  ok('점수가 4~96 안에 있다', r.curve.every((p) => p.score >= 4 && p.score <= 96));
  ok('모든 구간에 이름과 문장이 있다', r.curve.every((p) => p.label && (p.pre || p.line)));
  ok('지금 구간을 짚는다', r.current.pt.startMonths <= r.ageMonths && r.ageMonths <= r.current.pt.endMonths);
  ok('색을 쓸 오행이 실려 있다', r.curve.every((p) => Number.isInteger(p.stemEl) && p.stemEl >= 0 && p.stemEl <= 4));

  // 곡선이 0개월부터 빈틈없이 덮는가 — 표본을 넓게 훑는다
  let gaps = 0, n0 = 0;
  for (let y = 1960; y <= 2010; y += 3) for (const m of [1, 3, 5, 7, 9, 11]) {
    const c = build({ year: y, month: m, day: 4, hour: 9, minute: 0, gender: m % 2 ? 'M' : 'F' });
    n0++;
    if (c.curve[0].startMonths !== 0) gaps++;
  }
  ok(`${n0}개 표본이 모두 0개월부터 덮인다`, gaps === 0, `어긋난 표본 ${gaps}개`);

  // 대운 아홉 마디를 지난 분에게 마지막 마디를 '지금'이라 하면 안 된다
  const old = build({ year: 1901, month: 3, day: 5, hour: 8, minute: 0, gender: 'M' });
  ok('90년을 넘기면 status 가 after', old.current.status === 'after',
    `${(old.ageMonths / 12).toFixed(0)}세 / 마지막 ${(old.curve[old.curve.length - 1].endMonths / 12).toFixed(0)}세 / ${old.current.status}`);
  const mid = build({ year: 1988, month: 11, day: 3, hour: 7, minute: 20, gender: 'M' });
  ok('구간 안이면 status 가 current', mid.current.status === 'current', mid.current.status);
}

/* ══════════════ 5. 오늘의 운 ══════════════ */
group('5. 오늘의 운');
{
  const r = build({ year: 1990, month: 6, day: 15, hour: 14, minute: 30 });
  ok('오늘 간지가 두 글자', r.today.han.length === 2, r.today.han);
  ok('문구가 다 찼다', !!(r.today.mood && r.today.headline && r.today.why
    && r.today.work && r.today.people && r.today.body
    && r.today.doThis && r.today.avoid && r.today.watchFor && r.today.goodWith
    && r.today.air && r.today.bestTime));
  ok('오늘 지지와 내 일지의 관계를 짚는다', !!r.today.kind && !!r.today.kindLabel && !!r.today.kindLine,
    `${r.today.kind} / ${r.today.kindLabel}`);
  ok('내일 한 줄이 있다', !!(r.tomorrow && r.tomorrow.headline), r.tomorrow && r.tomorrow.ganji);

  // 60일을 돌려 하루도 빈 날이 없어야 한다
  const holes = [];
  for (let i = 0; i < 60; i++) {
    const when = new Date(Date.UTC(2026, 0, 1 + i, 3, 0));
    const t = Report.todayLuck(global.Manse.compute({
      year: 1990, month: 6, day: 15, hour: 14, minute: 30,
      gender: 'F', unknownTime: false, useTrueSolar: true,
    }), when);
    if (!t.mood || !t.headline || !t.why || !t.air || !t.kindLabel) holes.push(t.ganji);
  }
  ok('60일 연속 빈 날 없음', holes.length === 0, holes.join(','));

  // 하루가 바뀌면 도장도 바뀐다 (캐시가 어제 운세를 물고 있으면 안 된다)
  const a = Report.dayStamp(new Date(Date.UTC(2026, 4, 10, 3, 0)));   // KST 12:00
  const b = Report.dayStamp(new Date(Date.UTC(2026, 4, 10, 15, 0)));  // KST 다음날 00:00
  ok('자정을 넘기면 날짜 도장이 바뀐다', a !== b, `${a} / ${b}`);
  const c23 = Report.dayStamp(new Date(Date.UTC(2026, 4, 10, 14, 30))); // KST 23:30
  ok('23시 이후는 다음 날로 넘어간다', c23 === '2026-05-11', c23);
}

/* ══════════════ 6. 강약·희소도 ══════════════ */
group('6. 강약과 희소도');
{
  let strong = 0, weak = 0, mid = 0, rare = 0, bal = 0, n = 0;
  for (let y = 1955; y <= 2010; y += 3) for (const m of [1, 4, 7, 10]) {
    const r = build({ year: y, month: m, day: 12, hour: 15, minute: 0 });
    n++;
    if (r.strength.label === '신강') strong++;
    else if (r.strength.label === '신약') weak++;
    else mid++;
    if (r.rarity.rare) rare++;
    if (r.rarity.balanced) bal++;
    if (!r.strength.note || !r.strength.caveat) { fail++; console.log('  ✗ 강약 설명/단서 누락'); }
  }
  ok('세 가지 강약이 모두 나온다', strong > 0 && weak > 0 && mid > 0, `강${strong}/중${mid}/약${weak} (${n}표본)`);
  ok('희소 판정이 소수에만 붙는다', rare / n < 0.35, `${rare}/${n}`);
  ok('고름 판정이 과반을 넘지 않는다', bal / n <= 0.6, `${bal}/${n}`);
  ok('희소와 고름은 함께 붙지 않는다', (() => {
    for (let y = 1960; y <= 2005; y += 5) {
      const r = build({ year: y, month: 6, day: 6, hour: 6, minute: 0 });
      if (r.rarity.rare && r.rarity.balanced) return false;
    }
    return true;
  })());
}

/* ══════════════ 7. 챕터 잠금 ══════════════ */
group('7. 챕터 잠금');
{
  const c = global.Manse.compute({ year: 1990, month: 6, day: 15, hour: 14, minute: 30,
    gender: 'F', unknownTime: false, useTrueSolar: true });
  const locked = Report.build(c, { unlocked: false });
  const open = Report.build(c, { unlocked: true });
  ok('잠긴 상태에서 4개만 열림', locked.chapters.filter((x) => x.open).length === 4);
  ok('열면 12개 모두 열림', open.chapters.filter((x) => x.open).length === 12);
  ok('무료 챕터는 잠기지 않는다', locked.chapters.filter((x) => x.free).every((x) => x.open));
}

/* ══════════════ 8. 시각 미상 ══════════════ */
group('8. 시각 미상');
{
  const r = build({ year: 1962, month: 8, day: 1, unknownTime: true, gender: 'M' });
  ok('시주 없이도 리포트가 선다', !!r.type.name && !!r.today.headline);
  ok('시주가 비어 있다', r.chart.pillars.hour === null);
  ok('곡선도 그려진다', r.curve.length > 0 && r.curve.every((p) => p.score != null));
}

/* ══════════════ 9. 곡선이 판 밖으로 튀지 않는가 ══════════════ */
group('9. 곡선 오버슈트');
{
  // app.js 의 smoothPath 와 같은 계산. 제어점 y 를 구간 끝값 사이로 눌러
  // 베지에가 볼록껍질 밖으로 못 나가게 한 것이 실제로 먹는지 본다.
  const clampY = (y, a, b) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), y));
  const bezMinMax = (p0, p1, p2, p3) => {
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const u = 1 - t;
      const v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return [lo, hi];
  };
  let worstLo = Infinity, worstHi = -Infinity, checked = 0;
  for (let y = 1900; y <= 2010; y += 2) for (const m of [1, 4, 7, 10]) for (const g of ['M', 'F']) {
    let r;
    try { r = build({ year: y, month: m, day: 1, hour: 0, minute: 0, gender: g }); } catch (e) { continue; }
    const ys = r.curve.map((p) => p.score);
    for (let i = 0; i < ys.length - 1; i++) {
      const a = ys[i - 1] !== undefined ? ys[i - 1] : ys[i];
      const b = ys[i], c2 = ys[i + 1];
      const d = ys[i + 2] !== undefined ? ys[i + 2] : c2;
      const k1 = clampY(b + (c2 - a) / 6, b, c2);
      const k2 = clampY(c2 - (d - b) / 6, b, c2);
      const mm = bezMinMax(b, k1, k2, c2);
      worstLo = Math.min(worstLo, mm[0]); worstHi = Math.max(worstHi, mm[1]);
    }
    checked++;
  }
  ok(`${checked}개 명식에서 곡선이 4~96 밖으로 안 나간다`,
    worstLo >= 3.99 && worstHi <= 96.01, `최저 ${worstLo.toFixed(2)} / 최고 ${worstHi.toFixed(2)}`);
}

/* ══════════════ 10. 오늘 날짜 표기 ══════════════ */
group('10. 오늘 날짜 표기');
{
  const c = global.Manse.compute({ year: 1990, month: 6, day: 15, hour: 14, minute: 30,
    gender: 'F', unknownTime: false, useTrueSolar: true });
  // KST 23:30 이면 일진은 다음 날 것이고, 화면에 쓰는 날짜도 같이 넘어가야 한다
  const late = new Date(Date.UTC(2026, 4, 10, 14, 30));
  const t = Report.todayLuck(c, late);
  ok('23시 이후 일진과 표시 날짜가 같은 날', t.stamp === '2026-05-11', t.stamp);
  const nextIljin = global.Manse.todayIljin(late);
  ok('stamp 가 가리키는 날의 일진과 일치',
    t.iljin.stem === nextIljin.stem && t.iljin.branch === nextIljin.branch);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
