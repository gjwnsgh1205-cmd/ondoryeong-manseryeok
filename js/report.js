/* ============================================================
   report.js — 명식 계산 결과를 "읽을 수 있는 리포트"로 조립한다.
   manseryeok.js 가 낸 숫자를 받아, content.js 의 글과 엮는다.
   계산은 여기서 하지 않는다. 해석만 한다.
   ============================================================ */
const Report = (() => {
  'use strict';

  const M = typeof Manse !== 'undefined' ? Manse : require('./manseryeok.js');
  const C = () => (typeof Content !== 'undefined' ? Content : (typeof window !== 'undefined' ? window.Content : null));

  /* ── 사주 여덟 글자가 만들 수 있는 경우의 수 ───────────────
     연주 60 × 월지 12(월간은 연간에 종속) × 일주 60 × 시지 12(시간은 일간에 종속)

     태어난 시각을 모르면 시주를 못 세운다. 그러면 마지막 12가 빠져 43,200 이다.
     화면에 "518,400가지 중 하나" 라고 띄우던 자리가 그 사람에게는 그냥 틀린 숫자였다.
     이 앱은 폼에서 "태어난 시각을 몰라요" 를 대놓고 받는다 — 적지 않은 사람이 그쪽이다. */
  const TOTAL_CHARTS = 60 * 12 * 60 * 12; // 518,400 — 여덟 글자를 다 세울 때
  const TOTAL_CHARTS_NO_HOUR = 60 * 12 * 60; // 43,200 — 시주가 없을 때

  const totalFor = (chart) =>
    (chart && chart.meta && chart.meta.assumedNoon) ? TOTAL_CHARTS_NO_HOUR : TOTAL_CHARTS;

  /* ── 실측 분위수 ──────────────────────────────────────────
     아래 숫자는 지어낸 게 아니라 1955–2011년 출생 20,000표본을 실제로 계산해
     얻은 것이다.  node tools/measure_rarity.js  로 언제든 다시 뽑을 수 있고,
     그 스크립트가 이 블록을 그대로 출력한다. */
  /* MEASURED:BEGIN */
  const SKEW_CUTS = [
    [1.1903, 0.5], [1.1403, 1], [1.0693, 2], [0.9546, 5],
    [0.8707, 10], [0.7718, 20], [0.7066, 30], [0.6423, 40], [0.5952, 50],
  ];
  const BALANCED_CUT = 0.5952;  // 하위 50% — 여기 아래여야 "고르다"고 말한다
  const WEAK_CUT = 0.2974;      // 하위 30%
  const STRONG_CUT = 0.5211;    // 상위 25%
  const R_LO = 0.09, R_HI = 0.75;
  const DOMINANT_CUT = 0.18;    // 이 그룹 비중이 남들 중앙값보다 위면 '왕'
  /* MEASURED:END */

  /* ── 자리마다 무게가 다르다 ───────────────────────────────
     강약은 여덟 글자를 똑같이 세는 게 아니다. 월지(월령)를 얻었는지가 뼈대고,
     일지는 일간이 앉은 자리라 그다음이며, 나머지는 거든다.
     계량화 연구들도 월지에 다른 자리의 서너 배를 준다. */
  const POS_W = {
    yearStem: 1.0, monthStem: 1.0, hourStem: 1.0,
    yearBranch: 1.0, monthBranch: 3.0, dayBranch: 1.5, hourBranch: 1.0,
  };
  const HIDDEN_SHARE = 0.35;   // 지지 무게 중 본기 외 지장간이 나눠 갖는 몫

  const SEASON_OF = { 인: '봄', 묘: '봄', 진: '봄', 사: '여름', 오: '여름', 미: '여름',
                      신: '가을', 유: '가을', 술: '가을', 해: '겨울', 자: '겨울', 축: '겨울' };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  /* ══════════════ 오행 치우침 ══════════════ */

  // 변동계수 — 오행이 고르면 0에 가깝고, 한쪽으로 몰릴수록 커진다.
  function skewScore(elCount) {
    const t = sum(elCount) || 1;
    const mean = 1 / 5;
    const v = elCount.reduce((a, x) => a + Math.pow(x / t - mean, 2), 0) / 5;
    return Math.sqrt(v) / mean;
  }

  function rarity(chart) {
    const s = skewScore(chart.elCount);
    let pct = 100;
    for (const [cut, p] of SKEW_CUTS) { if (s >= cut) { pct = p; break; } }

    // "상위 50%"는 아무 말도 아니다. 정말 드물 때만 드물다고 하고,
    // 정말 고를 때만 고르다고 한다. 나머지는 입을 다문다.
    const rare = pct <= 20;
    // BALANCED_CUT 은 상위 50% 컷이다. 그 아래면 치우침이 하위 절반에 든다.
    const balanced = s < BALANCED_CUT;

    return {
      skew: s,
      percentile: pct,
      rare, balanced,
      line: rare ? `오행이 한쪽으로 쏠린 정도가 상위 ${pct}%에 드는 명식이에요`
          : balanced ? '오행이 제법 고르게 퍼진 명식이에요'
          : '오행이 크게 치우치지도, 딱 고르지도 않은 명식이에요',
      total: totalFor(chart),
    };
  }

  /* ══════════════ 일간 강약 ══════════════ */

  // 자리별 무게를 실어 각 칸을 훑는다. 강약과 십성 세력이 같은 저울을 쓴다.
  function weighVisit(chart, visit) {
    const P = chart.pillars;
    for (const k of ['year', 'month', 'hour']) {
      const p = P[k];
      if (p) visit(POS_W[k + 'Stem'], p.stemInfo.el, p.stem, k + 'Stem');
    }
    for (const k of ['year', 'month', 'day', 'hour']) {
      const p = P[k];
      if (!p) continue;
      const w = POS_W[k + 'Branch'];
      const hid = p.branchInfo.hidden;
      const main = hid[hid.length - 1];
      const rest = hid.length - 1;
      if (rest <= 0) { visit(w, M.STEMS[main].el, main, k + 'Branch'); continue; }
      visit(w * (1 - HIDDEN_SHARE), M.STEMS[main].el, main, k + 'Branch');
      for (let i = 0; i < rest; i++) {
        visit(w * HIDDEN_SHARE / rest, M.STEMS[hid[i]].el, hid[i], k + 'Branch');
      }
    }
  }

  // 나와 같은 오행(비겁) + 나를 낳는 오행(인성) = 내 편
  function strengthRatio(chart) {
    const me = M.STEMS[chart.dayStem].el;
    let mine = 0, total = 0;
    weighVisit(chart, (w, el) => {
      total += w;
      if (el === me || el === (me + 4) % 5) mine += w;
    });
    return total ? mine / total : 0;
  }

  function strength(chart) {
    const ratio = strengthRatio(chart);
    const label = ratio >= STRONG_CUT ? '신강' : ratio < WEAK_CUT ? '신약' : '중화';
    return {
      ratio,
      label,
      // 0 = 아주 신약, 1 = 아주 신강. 대운 곡선의 기울기를 정한다.
      t: clamp((ratio - R_LO) / (R_HI - R_LO), 0, 1),
      note: label === '신강' ? '기운이 넉넉해서, 덜어내고 쓰는 쪽이 편한 명식이에요'
          : label === '신약' ? '기운이 얇은 편이라, 빌려오고 기대는 쪽이 편한 명식이에요'
          : '기운이 치우치지 않아서, 때에 따라 쓰임이 달라지는 명식이에요',
      // 변명 대신 방법을 말한다. "다를 수 있다"는 말은 읽는 사람의 신뢰만 깎는다.
      caveat: '태어난 달의 자리를 셋으로, 태어난 날의 자리를 하나 반으로 놓고 여덟 글자의 무게를 달아 계산했어요.',
    };
  }

  /* ══════════════ 유형 이름 ══════════════ */

  function typeName(chart) {
    const c = C();
    const stemK = M.STEMS[chart.dayStem].kor;              // 갑·을·병…
    const monthBranch = M.BRANCHES[chart.pillars.month.branch].kor; // 인·묘·진…
    const season = SEASON_OF[monthBranch];

    const noun = c && c.nouns && c.nouns[stemK];
    const mod = c && c.modifiers && c.modifiers[monthBranch];
    const def = c && c.defs && c.defs[stemK + season];

    /* 긴 글 한 편. 조각 카드를 대신한다.
       없으면(구판 content.js) 아래 낱개 필드로 그대로 그려진다 — 화면이 비지 않게. */
    const lf = c && c.longform && c.longform.natures;
    const chapter = lf ? lf[stemK + season] : null;

    return {
      stem: stemK, branch: monthBranch, season,
      name: mod && noun ? `${mod.modifier} ${noun.noun}` : `${stemK}일간`,
      // 긴 글의 {물상} 슬롯에 들어갈 값. 은유를 글 전체에 이어 붙이는 열쇠다.
      noun: noun ? noun.noun : '',
      nounGloss: noun ? noun.gloss : '',
      modGloss: mod ? mod.gloss : '',
      headline: def ? def.headline : '',
      body: def ? def.body : '',
      example: def ? def.example : '',
      strengthLine: def ? def.strength : '',
      cautionLine: def ? def.caution : '',
      chapter,
    };
  }

  /* ══════════════ 대운 곡선 ══════════════ */

  // 억부(抑扶) — 신약하면 도와주는 기운이, 신강하면 덜어내는 기운이 반갑다.
  const W_WEAK   = { 비겁: 1.0, 인성: 0.9, 식상: -0.4, 재성: -0.8, 관성: -1.0 };
  const W_STRONG = { 비겁: -1.0, 인성: -0.8, 식상: 0.9, 재성: 1.0, 관성: 0.6 };

  function groupOf(sipName) { return M.SIPSEONG_GROUP[sipName] || '비겁'; }

  function weightFor(t) {
    const w = {};
    for (const k of Object.keys(W_WEAK)) w[k] = W_WEAK[k] * (1 - t) + W_STRONG[k] * t;
    return w;
  }

  /* 원국에 이 기운이 이미 많은가(왕) 적은가(약).
     예전엔 sipCount 개수를 셌는데, 시주가 있으면 표본이 7개뿐이라
     2개만 있어도 28.6%가 되고 시각 미상이면 5개라 40%가 됐다.
     같은 기준이 입력에 따라 다른 강도를 갖는 건 기준이 아니다.
     강약과 같은 자리 무게 저울로 연속값을 낸다. */
  const shareCache = new WeakMap();
  function groupShares(chart) {
    const hit = shareCache.get(chart);
    if (hit) return hit;
    const acc = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    let total = 0;
    weighVisit(chart, (w, el, stemIdx) => {
      const g = groupOf(M.sipseong(chart.dayStem, stemIdx));
      if (acc[g] === undefined) return;
      acc[g] += w; total += w;
    });
    if (total) for (const k of Object.keys(acc)) acc[k] /= total;
    shareCache.set(chart, acc);
    return acc;
  }

  function isDominant(chart, group) {
    return (groupShares(chart)[group] || 0) > DOMINANT_CUT;
  }

  function luckCurve(chart) {
    const st = strength(chart);
    const w = weightFor(st.t);
    const c = C();
    const phases = (c && c.daeunPhases) || {};

    const score = (stemSip, branchSip) => {
      const raw = 0.6 * (w[groupOf(stemSip)] || 0) + 0.4 * (w[groupOf(branchSip)] || 0);
      return Math.round(clamp(50 + 45 * raw, 4, 96));
    };

    const pts = [];

    // 첫 대운 전 — 월주의 기운 아래에서 자란 시절
    const mp = chart.pillars.month;
    const preEnd = chart.meta.daeunStartTotalMonths;
    if (preEnd > 0) {
      pts.push({
        pre: true,
        startMonths: 0, endMonths: preEnd - 1,
        startAge: 0, endAge: Math.max(0, Math.floor((preEnd - 1) / 12)),
        ganji: mp.stemInfo.kor + mp.branchInfo.kor,
        han: mp.stemInfo.han + mp.branchInfo.han,
        stemSip: mp.stemSipseong, branchSip: mp.branchSipseong,
        stemEl: mp.stemInfo.el,
        group: groupOf(mp.stemSipseong),
        score: score(mp.stemSipseong, mp.branchSipseong),
        label: '태어난 자리', line: '아직 내 몫의 운이 오기 전, 태어난 달의 기운 아래서 자란 시절이에요',
        advice: '',
      });
    }

    for (const d of chart.daeun) {
      const g = groupOf(d.stemSip);
      const tone = isDominant(chart, g) ? '왕' : '약';
      const ph = phases[g + '-' + tone] || {};
      pts.push({
        pre: false,
        startMonths: d.startMonths, endMonths: d.endMonths,
        startAge: d.startAge, endAge: d.endAge,
        ganji: d.stemInfo.kor + d.branchInfo.kor,
        han: d.stemInfo.han + d.branchInfo.han,
        stemSip: d.stemSip, branchSip: d.branchSip,
        stemEl: d.stemInfo.el,
        group: g, tone,
        score: score(d.stemSip, d.branchSip),
        label: ph.label || g,
        line: ph.line || '',
        example: ph.example || '',
        advice: ph.advice || '',
        /* 이 십 년에 대한 긴 글. 사용자가 경쟁사 화면을 보여주며
           "이렇게 길게 써 달라" 고 한 자리가 바로 여기다.
           {대운간지} 슬롯에 넣을 값은 아래 ganji 를 그대로 쓴다. */
        chapter: (c && c.longform && c.longform.daeun
                  && c.longform.daeun[g + '-' + tone]) || null,
      });
    }
    return pts;
  }

  function ageMonthsNow(chart, now = new Date()) {
    const b = chart.input;
    const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    let months = (y - b.year) * 12 + (m - b.month);
    if (d < b.day) months -= 1;
    return Math.max(0, months);
  }

  /* 대운은 아홉 구간, 약 90년까지만 세운다.
     그보다 오래 사신 분에게 마지막 구간을 "지금 여기"라 하면 거짓말이 된다.
     범위를 벗어났다는 사실을 그대로 돌려준다. */
  function currentPoint(curve, ageM) {
    for (let i = 0; i < curve.length; i++) {
      if (ageM >= curve[i].startMonths && ageM <= curve[i].endMonths) {
        return { idx: i, pt: curve[i], status: 'current' };
      }
    }
    const last = curve.length - 1;
    if (ageM > curve[last].endMonths) return { idx: last, pt: curve[last], status: 'after' };
    return { idx: 0, pt: curve[0], status: 'before' };
  }

  /* ══════════════ 오늘의 운 ══════════════ */

  /* 오늘 지지가 태어난 날의 지지(일지)와 어떻게 만나는가.
     일지는 '내 자리, 내 몸'으로 보는 칸이라, 여기가 부딪히면 하루 체감이 확 달라진다.
     "오늘 유난히 안 풀리네" 의 진짜 근거가 여기 있는데 지금까지 안 보고 있었다.

     지지 차례: 자0 축1 인2 묘3 진4 사5 오6 미7 신8 유9 술10 해11
       충   — 마주 보는 자리. 인덱스 차가 정확히 6
       육합 — 짝이 맞물림. 자축 / 인해 / 묘술 / 진유 / 사신 / 오미 → 합이 1 또는 13
       삼합 — 셋이 한 무리. 신자진 / 해묘미 / 인오술 / 사유축 → 인덱스를 4로 나눈 나머지가 같다 */
  function branchRelation(a, b) {
    if (a === b) return '같음';
    if ((a + 6) % 12 === b) return '충';
    if (a + b === 1 || a + b === 13) return '육합';
    if (a % 4 === b % 4) return '삼합';
    return '보통';
  }

  function todayLuck(chart, now = new Date()) {
    const ilj = M.todayIljin(now);
    const rel = M.sipseong(chart.dayStem, ilj.stem);
    const c = C();
    const r = (c && c.todayRelations && c.todayRelations[rel]) || {};
    const f = (c && c.todayBranches && c.todayBranches[ilj.branchInfo.kor]) || {};

    const myBranch = chart.pillars.day.branch;
    const kind = branchRelation(ilj.branch, myBranch);
    const k = (c && c.branchKinds && c.branchKinds[kind]) || {};

    return {
      iljin: ilj,
      ganji: ilj.stemInfo.kor + ilj.branchInfo.kor,
      han: ilj.stemInfo.han + ilj.branchInfo.han,
      relation: rel,
      group: groupOf(rel),

      mood: r.mood || '',
      headline: r.headline || r.line || '',
      why: r.why || '',
      work: r.work || '',
      people: r.people || '',
      body: r.body || '',
      doThis: r.doThis || '',
      avoid: r.avoid || '',
      watchFor: r.watchFor || '',
      goodWith: r.goodWith || '',

      air: f.air || f.flavor || '',
      bestTime: f.bestTime || '',
      bestWhy: f.bestWhy || '',

      // 오늘 지지 × 내 일지
      kind,
      kindLabel: k.label || '',
      kindLine: k.line || '',
      kindTip: k.tip || '',
      special: kind !== '보통',

      /* 오늘의 긴 글.
         다만 오늘 화면은 일부러 짧게 둔다 — 매일 여는 자리라 1분 안에
         핵심과 행동이 잡혀야 습관이 된다. 긴 글은 첫 문단만 펴 두고
         나머지는 접어서, 더 읽고 싶은 사람만 열게 한다.
         긴 글을 앞세우는 건 자주 안 바뀌는 기질과 대운 쪽이다. */
      chapter: (c && c.longform && c.longform.today && c.longform.today[rel]) || null,

      // 하루가 바뀌면 다시 계산해야 한다 — 캐시 키
      stamp: dayStamp(now),
    };
  }

  /* ══════════════ 오늘의 점수 ══════════════
     숫자를 먼저 던지고, 그 숫자가 어디서 나왔는지 전부 까발린다.

     운세 앱이 점수를 주면서 근거를 안 밝히는 건 밝힐 게 없어서다.
     우리는 절기를 초 단위로 잡고 92개 테스트로 검증한 엔진이 있다.
     근거를 열어놓을수록 유리한 유일한 자리이므로, 계산 과정을 통째로 돌려준다. */

  /* 하루를 볼 때의 자리 무게. 강약(POS_W)과 다르다.
     강약은 월령(태어난 달)이 뼈대라 월지가 제일 무겁지만,
     오늘 하루는 '내가 앉은 자리'인 일지가 먼저 맞는다. */
  const DAY_W = { day: 3.0, month: 1.5, hour: 1.2, year: 1.0 };
  const REL_SCORE = { 육합: 1.0, 삼합: 0.7, 같음: 0.3, 보통: 0, 충: -1.0 };
  const REL_WORD = {
    육합: '맞물림', 삼합: '한 무리', 같음: '겹침', 보통: '얽히지 않음', 충: '부딪힘',
  };
  const PILLAR_KOR = { year: '연지', month: '월지', day: '일지', hour: '시지' };

  function todayScore(chart, now = new Date()) {
    const ilj = M.todayIljin(now);
    const st = strength(chart);
    const w = weightFor(st.t);
    const parts = [];

    // ① 오늘 천간이 내 일간에게 무엇이 되는가 → 억부로 반가운지 아닌지
    const rel = M.sipseong(chart.dayStem, ilj.stem);
    const g = groupOf(rel);
    const stemDelta = Math.round((w[g] || 0) * 18);
    parts.push({
      kind: 'stem',
      label: `오늘 천간 ${ilj.stemInfo.han}(${ilj.stemInfo.kor})`,
      detail: `내 일간 ${M.STEMS[chart.dayStem].han}에게 ${rel}(${g})`,
      why: st.label === '신강'
        ? `기운이 넉넉한 편이라 ${g}은(는) ${w[g] >= 0 ? '반가운' : '부담되는'} 자리예요`
        : st.label === '신약'
          ? `기운이 얇은 편이라 ${g}은(는) ${w[g] >= 0 ? '반가운' : '부담되는'} 자리예요`
          : `${g}이(가) ${w[g] >= 0 ? '거들어주는' : '힘을 빼는'} 쪽으로 들어와요`,
      delta: stemDelta,
    });

    // ② 오늘 지지가 내 네 지지와 각각 어떻게 만나는가
    let wSum = 0, rSum = 0;
    for (const k of ['day', 'month', 'hour', 'year']) {
      const p = chart.pillars[k];
      if (!p) continue;
      const kind = branchRelation(ilj.branch, p.branch);
      const weight = DAY_W[k];
      wSum += weight;
      rSum += (REL_SCORE[kind] || 0) * weight;
      parts.push({
        kind: 'branch', pillar: k,
        label: `${PILLAR_KOR[k]} ${p.branchInfo.han}(${p.branchInfo.kor})`,
        detail: `오늘 ${ilj.branchInfo.han}과(와) ${REL_WORD[kind]}`,
        relation: kind,
        weight,
        delta: 0,   // 아래에서 정규화한 뒤 채운다
      });
    }
    // 지지 몫은 전체에서 ±22점까지만 움직이게 정규화한다
    const branchDelta = wSum ? Math.round((rSum / wSum) * 22) : 0;
    const bParts = parts.filter((p) => p.kind === 'branch');
    bParts.forEach((p) => {
      p.delta = wSum ? Math.round(((REL_SCORE[p.relation] || 0) * p.weight / wSum) * 22) : 0;
    });

    const score = clamp(50 + stemDelta + branchDelta, 5, 95);

    return {
      score,
      base: 50,
      parts,
      // 가중치를 숨기지 않는다. 저쪽도 이걸 공개해서 신뢰를 얻었다.
      weightNote: '일지 > 월지 > 시지 > 연지 순으로 비중이 들어갑니다. 태어난 날의 자리가 오늘을 먼저 맞기 때문이에요.',
      strengthNote: `기운의 두께는 ${st.label}로 봤어요. 같은 기운이 들어와도 두께에 따라 반가운 쪽이 달라집니다.`,
      /* 등급 컷도 지어내지 않는다. 5명 × 365일 = 1,825일을 실제로 계산해
         얻은 분위수다 (p10 41 · p25 47 · p50 54 · p75 60 · p90 66).
         어림수(70/60/50)로 자르면 절반이 한 칸에 몰려 등급이 뜻을 잃는다. */
      band: score >= 66 ? '순한 날' : score >= 60 ? '무난한 날'
          : score >= 47 ? '고른 날' : score >= 41 ? '뻑뻑한 날' : '버티는 날',
    };
  }

  /* ══════════════ 이번 주 ══════════════
     오늘 하나만 보여주면 "그래서 이번 주는 어떤데" 가 남는다.
     이레치를 미리 계산해 가장 순한 날과 뻑뻑한 날을 짚어준다. */
  function weekAhead(chart, now = new Date()) {
    const days = [];
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 0; i < 7; i++) {
      const when = new Date(now.getTime() + i * 86400000);
      const s = todayScore(chart, when);
      const ilj = M.todayIljin(when);
      const stamp = dayStamp(when);
      const [y, m, d] = stamp.split('-').map(Number);
      days.push({
        offset: i, stamp,
        month: m, date: d,
        weekday: WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
        ganji: ilj.stemInfo.kor + ilj.branchInfo.kor,
        han: ilj.stemInfo.han + ilj.branchInfo.han,
        score: s.score,
        isToday: i === 0,
      });
    }
    const best = days.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = days.reduce((a, b) => (b.score < a.score ? b : a));
    const avg = Math.round(days.reduce((a, b) => a + b.score, 0) / days.length);
    return { days, best, worst, avg };
  }

  // 내일 한 줄 — 오늘 다 읽은 사람에게 내일 다시 올 이유를 준다
  function tomorrowPeek(chart, now = new Date()) {
    const t = todayLuck(chart, new Date(now.getTime() + 86400000));
    return { ganji: t.ganji, han: t.han, mood: t.mood, headline: t.headline, kind: t.kind };
  }

  // KST 기준 날짜 도장. 23시 이후는 다음 날 일진이므로 그 경계를 그대로 따른다.
  function dayStamp(now = new Date()) {
    const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
    let y = kst.getFullYear(), m = kst.getMonth() + 1, d = kst.getDate();
    if (kst.getHours() >= 23) {
      const t = new Date(Date.UTC(y, m - 1, d + 1));
      y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate();
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  /* ══════════════ 지금 흐름 ══════════════
     하루는 일진 하나로만 정해진다. 일진은 60갑자를 도니 오늘의 운은 정확히 60일마다
     똑같이 돌아온다 — 두 달만 써 보면 사용자가 알아챈다.
     그래서 '이번 달'과 '올해'를 함께 얹는다. 이 둘을 섞으면 한 사람이 보는 하루가
     360일을 넘어가고, 해가 바뀌면 또 달라진다. (tools/measure_repeat.js 로 잴 수 있다) */

  // 만세력에서 달은 달력이 아니라 절기로 갈린다. 오늘이 무슨 달인지 찾는다.
  function monthBranchNow(now = new Date()) {
    const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
    const nowJD = now.getTime() / 86400000 + 2440587.5;
    let y = kst.getFullYear();
    let terms = M.yearTerms(y);
    if (nowJD < terms[0].jd) { y -= 1; terms = M.yearTerms(y); }  // 아직 입춘 전이면 지난해 절기표
    let idx = 0;
    for (let i = 0; i < terms.length; i++) if (nowJD >= terms[i].jd) idx = i;
    return { idx, branch: (idx + 2) % 12, term: terms[idx].name };  // 입춘 = 인월(2)
  }

  function thisMonth(chart, now = new Date()) {
    const m = monthBranchNow(now);
    const info = M.BRANCHES[m.branch];
    return { branch: m.branch, kor: info.kor, han: info.han, term: m.term };
  }

  /* ══════════════ 올해의 운 ══════════════ */

  function thisYear(chart, now = new Date()) {
    const yp = M.currentYearPillar(now);
    const rel = M.sipseong(chart.dayStem, yp.stem);
    const g = groupOf(rel);
    const c = C();
    const tone = isDominant(chart, g) ? '왕' : '약';
    const ph = (c && c.daeunPhases && c.daeunPhases[g + '-' + tone]) || {};
    return {
      year: yp.year,
      ganji: yp.stemInfo.kor + yp.branchInfo.kor,
      han: yp.stemInfo.han + yp.branchInfo.han,
      relation: rel, group: g, tone,
      label: ph.label || g, line: ph.line || '', advice: ph.advice || '',
    };
  }

  /* 오늘 하루를 큰 흐름 위에 얹어 본다.
     대운은 10년, 세운은 1년, 월은 한 달마다 바뀐다.
     이 셋이 오늘의 십성과 엮이면서 같은 하루가 두 번 오지 않게 된다. */
  function flow(chart, now = new Date(), curveInfo) {
    const c = C();
    const ilj = M.todayIljin(now);
    const todayGroup = groupOf(M.sipseong(chart.dayStem, ilj.stem));

    // 올해
    const yp = M.currentYearPillar(now);
    const yRel = M.sipseong(chart.dayStem, yp.stem);
    const yTxt = (c && c.yearLines && c.yearLines[yRel]) || {};

    // 이번 달
    const mo = thisMonth(chart, now);
    const mTxt = (c && c.monthMeets && c.monthMeets[todayGroup] && c.monthMeets[todayGroup][mo.kor]) || '';

    // 지금 대운 — 곡선에서 이미 고른 것을 그대로 쓴다
    const pt = curveInfo && curveInfo.status === 'current' ? curveInfo.pt : null;

    return {
      daeun: pt ? { ganji: pt.ganji, han: pt.han, label: pt.label,
                    from: pt.startAge, to: pt.endAge, chapter: pt.chapter || null } : null,
      year: { year: yp.year, ganji: yp.stemInfo.kor + yp.branchInfo.kor,
              han: yp.stemInfo.han + yp.branchInfo.han,
              relation: yRel, label: yTxt.label || '', line: yTxt.line || '' },
      month: { kor: mo.kor, han: mo.han, term: mo.term, line: mTxt },
      todayGroup,
    };
  }

  /* ══════════════ 챕터 ══════════════ */

  function chapters(chart, unlocked) {
    const c = C();
    const list = (c && c.chapters) || [];
    return list.map((ch) => ({
      ...ch,
      open: ch.free || !!unlocked,
    }));
  }

  /* ══════════════ 전체 조립 ══════════════ */

  function build(chart, opt = {}) {
    const now = opt.now || new Date();
    const ageM = ageMonthsNow(chart, now);
    const curve = luckCurve(chart);
    const cur = currentPoint(curve, ageM);
    return {
      chart,
      type: typeName(chart),
      rarity: rarity(chart),
      strength: strength(chart),
      curve,
      ageMonths: ageM,
      current: cur,
      today: todayLuck(chart, now),
      score: todayScore(chart, now),
      week: weekAhead(chart, now),
      tomorrow: tomorrowPeek(chart, now),
      flow: flow(chart, now, cur),
      year: thisYear(chart, now),
      chapters: chapters(chart, opt.unlocked),
      totalCharts: totalFor(chart),
      // 시각을 모르면 여덟 글자가 아니라 여섯 글자다. 화면 문구가 이 값을 보고 갈린다.
      glyphCount: (chart.meta && chart.meta.assumedNoon) ? 6 : 8,
    };
  }

  return {
    TOTAL_CHARTS, TOTAL_CHARTS_NO_HOUR, totalFor, build, rarity, strength, typeName,
    luckCurve, todayLuck, tomorrowPeek, branchRelation, todayScore, weekAhead,
    thisYear, thisMonth, flow, chapters,
    ageMonthsNow, currentPoint, dayStamp,
    skewScore, strengthRatio, groupShares,
  };
})();

if (typeof module !== 'undefined') module.exports = Report;
