/* ============================================================
 * 만세력 엔진 회귀 테스트
 * 실행: node tests/run-tests.js  (저장소 루트 기준)
 * ============================================================ */

const path = require('path');
const ENGINE = path.join(__dirname, '..', 'js', 'manseryeok.js');
const COUNSEL = path.join(__dirname, '..', 'js', 'counsel.js');
const ASTRO = path.join(__dirname, 'vendor', 'astronomy.node.min.js');

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function ganji(p) { return p ? p.stemInfo.kor + p.branchInfo.kor : '--'; }
function fresh() { delete require.cache[require.resolve(ENGINE)]; return require(ENGINE); }

// ---------- 정밀 엔진 주입 ----------
const M = fresh();
const A = require(ASTRO);
M.setAstro(A);
global.Manse = M;
delete require.cache[require.resolve(COUNSEL)];
const C = require(COUNSEL);

console.log('\n[1] 일주 앵커');
{
  const g = (y, m, d) => { const i = ((M.jdn(y, m, d) + 49) % 60 + 60) % 60; return M.STEMS[i % 10].kor + M.BRANCHES[i % 12].kor; };
  ok(g(1900, 1, 1) === '갑술', '1900-01-01 = 갑술', g(1900, 1, 1));
  ok(g(2000, 1, 1) === '무오', '2000-01-01 = 무오', g(2000, 1, 1));
  ok(g(2024, 1, 1) === '갑자', '2024-01-01 = 갑자', g(2024, 1, 1));
}

console.log('\n[2] 절기 정밀도 (KASI 공표값 대비 ±2분)');
{
  const jd = M.yearTerms(2024)[0].jd; // 입춘 2024 — KASI 17:27 KST = 08:27 UTC
  const utcMin = (jd - Math.floor(jd + 0.5) + 0.5) * 1440; // 그날 UTC 분
  ok(Math.abs(utcMin - (8 * 60 + 27)) <= 2, '입춘 2024 = 08:27 UTC ± 2분', utcMin.toFixed(1) + '분');
}

console.log('\n[3] 입춘 경계 (연주 판정은 표준시 절대시각 기준)');
{
  const a = M.compute({ year: 2024, month: 2, day: 4, hour: 17, minute: 25, gender: 'M' });
  const b = M.compute({ year: 2024, month: 2, day: 4, hour: 17, minute: 30, gender: 'M' });
  ok(ganji(a.pillars.year) === '계묘', '17:25 → 계묘년', ganji(a.pillars.year));
  ok(ganji(b.pillars.year) === '갑진', '17:30 → 갑진년', ganji(b.pillars.year));
  ok(a.meta.boundaryWarning === true, '경계 경고 표시', String(a.meta.nearestTermMin));
}

console.log('\n[4] 자시(23시) 일주 전환 · 경도 보정');
{
  const a = M.compute({ year: 1990, month: 6, day: 15, hour: 23, minute: 40, gender: 'M' });
  const b = M.compute({ year: 1990, month: 6, day: 15, hour: 23, minute: 10, gender: 'M' });
  ok(ganji(a.pillars.day) === '임자' && ganji(a.pillars.hour) === '경자', '23:40 → 임자일 경자시', ganji(a.pillars.day) + ' ' + ganji(a.pillars.hour));
  ok(ganji(b.pillars.day) === '신해' && ganji(b.pillars.hour) === '기해', '23:10 → 신해일 기해시(보정 후 해시)', ganji(b.pillars.day) + ' ' + ganji(b.pillars.hour));
}

console.log('\n[5] 서머타임 1987/88 — 전환 시각 · gap · fold');
{
  const a = M.compute({ year: 1987, month: 10, day: 11, hour: 1, minute: 30, gender: 'F' });
  ok(a.meta.tzOffsetMin === 600, '1987-10-11 01:30 → UTC+10 (KDT)', String(a.meta.tzOffsetMin));
  const b = M.compute({ year: 1987, month: 10, day: 11, hour: 4, minute: 0, gender: 'F' });
  ok(b.meta.tzOffsetMin === 540, '1987-10-11 04:00 → UTC+9', String(b.meta.tzOffsetMin));
  const c = M.compute({ year: 1987, month: 10, day: 11, hour: 2, minute: 30, gender: 'F' });
  ok(c.meta.timeStatus === 'fold' && c.meta.tzOffsetMin === 540, '1987-10-11 02:30 → fold, 표준시 해석', c.meta.timeStatus + '/' + c.meta.tzOffsetMin);
  let threw = false;
  try { M.compute({ year: 1987, month: 5, day: 10, hour: 2, minute: 30, gender: 'F' }); } catch (e) { threw = true; }
  ok(threw, '1987-05-10 02:30 (gap) → 거부');
  threw = false;
  try { M.compute({ year: 1948, month: 6, day: 1, hour: 0, minute: 30, gender: 'M' }); } catch (e) { threw = true; }
  ok(threw, '1948-06-01 00:30 (gap) → 거부');
  // 1948~60 종료일 fold — 표준시 해석 (UTC+9 시대 540, UTC+8:30 시대 510)
  const f1 = M.compute({ year: 1948, month: 9, day: 12, hour: 23, minute: 30, gender: 'M' });
  ok(f1.meta.timeStatus === 'fold' && f1.meta.tzOffsetMin === 540, '1948-09-12 23:30 → fold, 표준시 540', f1.meta.timeStatus + '/' + f1.meta.tzOffsetMin);
  const f2 = M.compute({ year: 1955, month: 9, day: 8, hour: 23, minute: 30, gender: 'M' });
  ok(f2.meta.timeStatus === 'fold' && f2.meta.tzOffsetMin === 510, '1955-09-08 23:30 → fold, 표준시 510', f2.meta.timeStatus + '/' + f2.meta.tzOffsetMin);
  // fold 직전(22시대)은 여전히 DST
  const f3 = M.compute({ year: 1948, month: 9, day: 12, hour: 22, minute: 30, gender: 'M' });
  ok(f3.meta.tzOffsetMin === 600, '1948-09-12 22:30 → 아직 KDT 600', String(f3.meta.tzOffsetMin));
}

console.log('\n[6] 대운 — 개월 단위 구간 판정');
{
  const r = M.compute({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: 'M' });
  const start = r.meta.daeunStartTotalMonths;
  ok(r.daeun[0].startMonths === start, '첫 대운 startMonths = 총개월', start + ' vs ' + r.daeun[0].startMonths);
  ok(r.meta.daeunAge === Math.floor(start / 12) && r.meta.daeunMonths === start % 12, '년·개월 분해 일치');
  ok(r.daeun.every(d => d.endAge === Math.floor(d.endMonths / 12)), 'endAge = floor(endMonths/12)');
  ok(r.daeun.every(d => d.endMonths === d.startMonths + 119), '구간 길이 120개월');
  ok(C.currentDaeun(r.daeun, start - 1).status === 'before', '시작 1개월 전 → before');
  ok(C.currentDaeun(r.daeun, start).status === 'current', '시작 개월 → current');
  ok(C.currentDaeun(r.daeun, start + 120).daeun.startMonths === start + 120, '120개월 뒤 → 둘째 대운');
  ok(C.currentDaeun(r.daeun, start + 9 * 120 + 5).status === 'after', '마지막 구간 이후 → after');
  const f = M.compute({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: 'F' });
  ok(f.meta.forward === false && ganji({ stemInfo: f.daeun[0].stemInfo, branchInfo: f.daeun[0].branchInfo }) === '신사', '경오년 여성 → 역행, 첫 대운 신사');
}

console.log('\n[7] 오행 분포 정규화');
{
  const r = M.compute({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: 'M' });
  const s = r.elCount.reduce((x, y) => x + y, 0);
  ok(Math.abs(s - 8) < 1e-9, '시주 포함 합계 8.0', s.toFixed(3));
  const u = M.compute({ year: 1985, month: 3, day: 10, gender: 'F', unknownTime: true });
  const s2 = u.elCount.reduce((x, y) => x + y, 0);
  ok(Math.abs(s2 - 6) < 1e-9, '시각 미상 합계 6.0', s2.toFixed(3));
  ok(u.pillars.hour === null, '시각 미상 → 시주 없음');
  ok(u.meta.assumedNoon === true, '정오 가정 플래그');
}

console.log('\n[8] 범위 계약 · 절입일 경고 · 정밀 플래그');
{
  let threw = false;
  try { M.compute({ year: 1899, month: 5, day: 1, hour: 1, minute: 0, gender: 'M' }); } catch (e) { threw = true; }
  ok(threw, '1899년 → 거부');
  threw = false;
  try { M.compute({ year: 2051, month: 1, day: 1, hour: 1, minute: 0, gender: 'M' }); } catch (e) { threw = true; }
  ok(threw, '2051년 → 거부');
  const t = M.compute({ year: 2024, month: 2, day: 4, gender: 'M', unknownTime: true });
  ok(t.meta.termDayWarning === true, '절입일 + 시각 미상 → 경고');
  ok(t.meta.precise === true, '정밀 엔진 사용 시 precise=true');
}

console.log('\n[9] 폴백 경로 (astronomy-engine 미주입)');
{
  const M2 = fresh(); // setAstro 하지 않음
  const r = M2.compute({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: 'M' });
  ok(r.meta.precise === false, '폴백 사용 시 precise=false');
  ok(ganji(r.pillars.day) === '신해', '폴백에서도 일주 동일(신해)', ganji(r.pillars.day));
  const jdP = M.yearTerms(2024)[0].jd, jdF = M2.yearTerms(2024)[0].jd;
  ok(Math.abs(jdP - jdF) * 1440 < 15, '폴백 절기 오차 15분 이내', (Math.abs(jdP - jdF) * 1440).toFixed(1) + '분');
}

console.log('\n[10] 오늘의 일진 23시 규칙');
{
  const d1 = M.todayIljin(new Date('2026-08-07T13:00:00Z')); // KST 22:00
  const d2 = M.todayIljin(new Date('2026-08-07T14:30:00Z')); // KST 23:30 → 다음날 일진
  const idx1 = ((M.jdn(2026, 8, 7) + 49) % 60 + 60) % 60;
  const idx2 = ((M.jdn(2026, 8, 8) + 49) % 60 + 60) % 60;
  ok(d1.stem === idx1 % 10 && d1.branch === idx1 % 12, 'KST 22:00 → 당일 일진');
  ok(d2.stem === idx2 % 10 && d2.branch === idx2 % 12, 'KST 23:30 → 익일 일진');
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail === 0 ? 0 : 1);
