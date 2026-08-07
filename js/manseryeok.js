/* ============================================================
 * 만세력 계산 엔진 (manseryeok.js)
 * - 태양 황경(Meeus 근사) 기반 절기 계산으로 연주/월주 결정
 * - 율리우스일 기반 일주, 오호둔/오서둔 규칙으로 월간/시간 결정
 * - 지장간 · 십성 · 오행 분포 · 대운 계산
 * ============================================================ */

const Manse = (() => {
  // ---------- 기본 상수 ----------
  const STEMS = [
    { han: '甲', kor: '갑', el: 0, yang: true },
    { han: '乙', kor: '을', el: 0, yang: false },
    { han: '丙', kor: '병', el: 1, yang: true },
    { han: '丁', kor: '정', el: 1, yang: false },
    { han: '戊', kor: '무', el: 2, yang: true },
    { han: '己', kor: '기', el: 2, yang: false },
    { han: '庚', kor: '경', el: 3, yang: true },
    { han: '辛', kor: '신', el: 3, yang: false },
    { han: '壬', kor: '임', el: 4, yang: true },
    { han: '癸', kor: '계', el: 4, yang: false },
  ];

  const BRANCHES = [
    { han: '子', kor: '자', animal: '쥐',   el: 4, yang: true,  hidden: [8, 9] },
    { han: '丑', kor: '축', animal: '소',   el: 2, yang: false, hidden: [9, 7, 5] },
    { han: '寅', kor: '인', animal: '호랑이', el: 0, yang: true,  hidden: [4, 2, 0] },
    { han: '卯', kor: '묘', animal: '토끼', el: 0, yang: false, hidden: [0, 1] },
    { han: '辰', kor: '진', animal: '용',   el: 2, yang: true,  hidden: [1, 9, 4] },
    { han: '巳', kor: '사', animal: '뱀',   el: 1, yang: false, hidden: [4, 6, 2] },
    { han: '午', kor: '오', animal: '말',   el: 1, yang: true,  hidden: [2, 5, 3] },
    { han: '未', kor: '미', animal: '양',   el: 2, yang: false, hidden: [3, 1, 5] },
    { han: '申', kor: '신', animal: '원숭이', el: 3, yang: true,  hidden: [4, 8, 6] },
    { han: '酉', kor: '유', animal: '닭',   el: 3, yang: false, hidden: [6, 7] },
    { han: '戌', kor: '술', animal: '개',   el: 2, yang: true,  hidden: [7, 3, 4] },
    { han: '亥', kor: '해', animal: '돼지', el: 4, yang: false, hidden: [4, 0, 8] },
  ];
  // hidden(지장간)은 STEM 인덱스, 마지막 원소가 본기(정기)

  const ELEMENTS = [
    { kor: '목', han: '木' },
    { kor: '화', han: '火' },
    { kor: '토', han: '土' },
    { kor: '금', han: '金' },
    { kor: '수', han: '水' },
  ];

  const SIPSEONG = [
    '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  ];
  const SIPSEONG_GROUP = { 비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성' };

  // ---------- 율리우스일 ----------
  // 그레고리력 y-m-d 정오의 정수 JDN
  function jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
      Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  }
  // y-m-d hh:mm(UTC) → 실수 JD
  function jdUTC(y, m, d, hh, mm) {
    return jdn(y, m, d) - 0.5 + (hh + mm / 60) / 24;
  }
  function jdToDateUTC(jd) {
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let a = z;
    if (z >= 2299161) {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const dd = Math.floor(365.25 * c);
    const e = Math.floor((b - dd) / 30.6001);
    const day = b - dd - Math.floor(30.6001 * e) + f;
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    const dayInt = Math.floor(day);
    const frac = day - dayInt;
    const totalMin = Math.round(frac * 1440);
    return { y: year, m: month, d: dayInt, hh: Math.floor(totalMin / 60), mm: totalMin % 60 };
  }

  // ---------- 태양 황경 (Meeus 근사, 오차 ≈ 수 분 이내) ----------
  function solarLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * Math.PI / 180;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
      + 0.000289 * Math.sin(3 * M);
    const trueLong = L0 + C;
    const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
    const apparent = trueLong - 0.00569 - 0.00478 * Math.sin(omega);
    return ((apparent % 360) + 360) % 360;
  }

  // 목표 황경(deg)에 도달하는 시각을 근사 JD에서 뉴턴 반복으로 탐색
  function findTermJD(approxJD, targetDeg) {
    let jd = approxJD;
    for (let i = 0; i < 30; i++) {
      let diff = targetDeg - solarLongitude(jd);
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      if (Math.abs(diff) < 1e-6) break;
      jd += diff / 0.9856473; // 태양 평균 이동 deg/day
    }
    return jd;
  }

  // 사주 월을 정하는 12절(節) — 입춘 315°부터 30° 간격
  // monthIdx 0 = 寅월(입춘) … 11 = 丑월(소한)
  const TERM_NAMES = ['입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동', '대설', '소한'];
  // 각 절의 대략적 (월, 일) — 탐색 시작점
  const TERM_APPROX = [[2, 4], [3, 6], [4, 5], [5, 6], [6, 6], [7, 7], [8, 8], [9, 8], [10, 8], [11, 7], [12, 7], [1, 6]];

  // year년 입춘 기준 절기 12개의 JD(UTC). idx 11(소한)은 year+1년 1월
  function yearTerms(year) {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const target = (315 + 30 * i) % 360;
      let [am, ad] = TERM_APPROX[i];
      const ay = i === 11 ? year + 1 : year;
      out.push({ idx: i, name: TERM_NAMES[i], jd: findTermJD(jdUTC(ay, am, ad, 0, 0), target) });
    }
    return out;
  }

  // ---------- 한국 표준시 이력 ----------
  // 반환: UTC 오프셋(분). dst 적용 시 실제 벽시계 기준으로 보정
  const DST_RANGES = [ // [시작 y,m,d, 끝 y,m,d] (벽시계 날짜, 경계일 포함)
    [1948, 6, 1, 1948, 9, 12], [1949, 4, 3, 1949, 9, 10], [1950, 4, 1, 1950, 9, 9],
    [1951, 5, 6, 1951, 9, 8], [1955, 5, 5, 1955, 9, 8], [1956, 5, 20, 1956, 9, 29],
    [1957, 5, 5, 1957, 9, 21], [1958, 5, 4, 1958, 9, 20], [1959, 5, 3, 1959, 9, 19],
    [1960, 5, 1, 1960, 9, 17], [1987, 5, 10, 1987, 10, 10], [1988, 5, 8, 1988, 10, 8],
  ];
  function kstOffsetMin(y, m, d) {
    let off;
    if (y < 1912) off = 510;                                    // UTC+8:30
    else if (y < 1954 || (y === 1954 && (m < 3 || (m === 3 && d < 21)))) off = 540;
    else if (y < 1961 || (y === 1961 && (m < 8 || (m === 8 && d < 10)))) off = 510; // 54.3.21~61.8.9 UTC+8:30
    else off = 540;
    const key = y * 10000 + m * 100 + d;
    for (const [sy, sm, sd, ey, em, ed] of DST_RANGES) {
      if (key >= sy * 10000 + sm * 100 + sd && key <= ey * 10000 + em * 100 + ed) { off += 60; break; }
    }
    return off;
  }

  // ---------- 십성 ----------
  function sipseong(dayStemIdx, otherStemIdx) {
    const d = STEMS[dayStemIdx], o = STEMS[otherStemIdx];
    const same = d.yang === o.yang;
    let rel;
    if (d.el === o.el) rel = 0;                       // 비겁
    else if ((d.el + 1) % 5 === o.el) rel = 1;        // 식상 (내가 생함)
    else if ((d.el + 2) % 5 === o.el) rel = 2;        // 재성 (내가 극함)
    else if ((o.el + 2) % 5 === d.el) rel = 3;        // 관성 (나를 극함)
    else rel = 4;                                     // 인성 (나를 생함)
    return SIPSEONG[rel * 2 + (same ? 0 : 1)];
  }

  // ---------- 메인 계산 ----------
  /**
   * @param {Object} input {year,month,day,hour,minute,gender:'M'|'F',unknownTime:boolean,useTrueSolar:boolean}
   */
  function compute(input) {
    const { year, month, day, gender } = input;
    const unknownTime = !!input.unknownTime;
    const hour = unknownTime ? 12 : input.hour;
    const minute = unknownTime ? 0 : input.minute;
    const useTrueSolar = input.useTrueSolar !== false;

    // 1) 벽시계 → 표준시 → 진태양시 보정(-30분, 동경 127.5°)
    const offMin = kstOffsetMin(year, month, day);
    let adjMin = hour * 60 + minute;
    let adjY = year, adjM = month, adjD = day;
    if (useTrueSolar && !unknownTime) adjMin -= 30;
    // 표준시가 +8:30 시기였다면 진태양시 보정은 이미 반영된 셈 → +30 되돌림
    if (useTrueSolar && !unknownTime && offMin % 60 === 30) adjMin += 30;
    // 서머타임이었으면 -60 (kstOffsetMin은 DST 포함 오프셋을 반환)
    const baseOff = (offMin % 60 === 30) ? 510 : 540;
    if (offMin - baseOff === 60) adjMin -= 60; // 서머타임 보정
    // 날짜 넘김 처리
    while (adjMin < 0) { adjMin += 1440; const p = prevDay(adjY, adjM, adjD); adjY = p.y; adjM = p.m; adjD = p.d; }
    while (adjMin >= 1440) { adjMin -= 1440; const n = nextDay(adjY, adjM, adjD); adjY = n.y; adjM = n.m; adjD = n.d; }
    const adjHour = Math.floor(adjMin / 60), adjMinute = adjMin % 60;

    // 2) UTC JD (절기 비교용) — 표준시 기준
    let utcMin = hour * 60 + minute - (offMin);
    let uY = year, uM = month, uD = day;
    while (utcMin < 0) { utcMin += 1440; const p = prevDay(uY, uM, uD); uY = p.y; uM = p.m; uD = p.d; }
    while (utcMin >= 1440) { utcMin -= 1440; const n = nextDay(uY, uM, uD); uY = n.y; uM = n.m; uD = n.d; }
    const birthJD = jdUTC(uY, uM, uD, Math.floor(utcMin / 60), utcMin % 60);

    // 3) 연주 — 입춘 기준
    const ipchunThis = yearTerms(year)[0].jd;
    const sajuYear = birthJD >= ipchunThis ? year : year - 1;
    const yStem = ((sajuYear - 4) % 10 + 10) % 10;
    const yBranch = ((sajuYear - 4) % 12 + 12) % 12;

    // 4) 월주 — 절기 기준
    const terms = yearTerms(sajuYear);
    let monthIdx = 0;
    for (let i = 0; i < 12; i++) {
      if (birthJD >= terms[i].jd) monthIdx = i; else break;
    }
    const mBranch = (2 + monthIdx) % 12; // 입춘→寅(2)
    const mStem = (((yStem % 5) * 2 + 2) + monthIdx) % 10;

    // 5) 일주 — 진태양시 기준, 23시(자시)부터 다음 날로 취급
    let dY = adjY, dM = adjM, dD = adjD;
    if (!unknownTime && adjHour >= 23) { const n = nextDay(dY, dM, dD); dY = n.y; dM = n.m; dD = n.d; }
    const dayIdx60 = ((jdn(dY, dM, dD) + 49) % 60 + 60) % 60;
    const dStem = dayIdx60 % 10;
    const dBranch = dayIdx60 % 12;

    // 6) 시주
    let hStem = null, hBranch = null;
    if (!unknownTime) {
      hBranch = Math.floor((adjMin + 60) / 120) % 12;
      hStem = ((dStem % 5) * 2 + hBranch) % 10;
    }

    // 7) 기둥 구성
    const mkPillar = (s, b, label) => ({
      label,
      stem: s, branch: b,
      stemInfo: STEMS[s], branchInfo: BRANCHES[b],
      stemSipseong: sipseong(dStem, s),
      branchSipseong: sipseong(dStem, BRANCHES[b].hidden[BRANCHES[b].hidden.length - 1]),
      hidden: BRANCHES[b].hidden.map(hs => ({ idx: hs, info: STEMS[hs], sip: sipseong(dStem, hs) })),
    });
    const pillars = {
      year: mkPillar(yStem, yBranch, '연주'),
      month: mkPillar(mStem, mBranch, '월주'),
      day: mkPillar(dStem, dBranch, '일주'),
      hour: unknownTime ? null : mkPillar(hStem, hBranch, '시주'),
    };
    pillars.day.stemSipseong = '일간(나)';

    // 8) 오행 분포 (천간 1.0, 지지 본기 1.0, 지장간 여기 0.3)
    const elCount = [0, 0, 0, 0, 0];
    const addP = (p) => {
      if (!p) return;
      elCount[p.stemInfo.el] += 1;
      const hid = p.branchInfo.hidden;
      elCount[STEMS[hid[hid.length - 1]].el] += 1;
      for (let i = 0; i < hid.length - 1; i++) elCount[STEMS[hid[i]].el] += 0.3;
    };
    Object.values(pillars).forEach(addP);

    // 9) 십성 분포 (일간 제외 천간 + 지지 본기)
    const sipCount = {};
    const addSip = (name) => { sipCount[name] = (sipCount[name] || 0) + 1; };
    Object.entries(pillars).forEach(([k, p]) => {
      if (!p) return;
      if (k !== 'day') addSip(sipseong(dStem, p.stem));
      addSip(p.branchSipseong);
    });

    // 10) 대운
    const yangYear = STEMS[yStem].yang;
    const forward = (yangYear && gender === 'M') || (!yangYear && gender === 'F');
    let gapDays;
    if (forward) {
      const nextTerm = monthIdx === 11 ? yearTerms(sajuYear + 1)[0] : terms[monthIdx + 1];
      gapDays = nextTerm.jd - birthJD;
    } else {
      gapDays = birthJD - terms[monthIdx].jd;
    }
    let daeunAge = Math.round(gapDays / 3);
    if (daeunAge < 1) daeunAge = 1;
    if (daeunAge > 10) daeunAge = 10;
    const mIdx60 = findGanjiIndex(mStem, mBranch);
    const daeun = [];
    for (let i = 1; i <= 9; i++) {
      const gi = ((mIdx60 + (forward ? i : -i)) % 60 + 60) % 60;
      const s = gi % 10, b = gi % 12;
      daeun.push({
        startAge: daeunAge + (i - 1) * 10,
        endAge: daeunAge + i * 10 - 1,
        stem: s, branch: b,
        stemInfo: STEMS[s], branchInfo: BRANCHES[b],
        stemSip: sipseong(dStem, s),
        branchSip: sipseong(dStem, BRANCHES[b].hidden[BRANCHES[b].hidden.length - 1]),
      });
    }

    return {
      input: { ...input },
      meta: {
        sajuYear, monthIdx, monthTerm: terms[monthIdx].name,
        adjusted: { y: adjY, m: adjM, d: adjD, hh: adjHour, mm: adjMinute },
        tzOffsetMin: offMin, forward, daeunAge, useTrueSolar,
      },
      pillars, elCount, sipCount, daeun,
      dayStem: dStem,
    };
  }

  function findGanjiIndex(stem, branch) {
    for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
    return 0;
  }
  function prevDay(y, m, d) {
    const t = jdToDateUTC(jdn(y, m, d) - 1);
    return { y: t.y, m: t.m, d: t.d };
  }
  function nextDay(y, m, d) {
    const t = jdToDateUTC(jdn(y, m, d) + 1);
    return { y: t.y, m: t.m, d: t.d };
  }

  // 오늘의 일진 (KST)
  function todayIljin(now = new Date()) {
    const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
    const idx = ((jdn(kst.getFullYear(), kst.getMonth() + 1, kst.getDate()) + 49) % 60 + 60) % 60;
    return { stem: idx % 10, branch: idx % 12, stemInfo: STEMS[idx % 10], branchInfo: BRANCHES[idx % 12] };
  }

  return { STEMS, BRANCHES, ELEMENTS, SIPSEONG_GROUP, compute, sipseong, todayIljin, yearTerms, jdn };
})();

if (typeof module !== 'undefined') module.exports = Manse;
