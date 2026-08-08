/* ============================================================
   app.js — 화면을 굴린다.
   흐름: 문 앞(생년월일) → 풀이(스크롤 리포트) → 상담(원한 사람만)
   질문을 먼저 받지 않는다. 태어난 때 하나만 받고 바로 결과를 보여준다.
   ============================================================ */
(() => {
  'use strict';

  /* ── 잔심부름 ─────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const num = (el) => { const v = parseInt(el.value, 10); return Number.isFinite(v) ? v : null; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const EL_VAR = (i) => `var(--el-${i})`;
  const STORE = 'ondoryeong.birth.v2';
  const STREAK = 'ondoryeong.streak.v1';
  const PASS = 'ondoryeong.pass.v1';      // 구독·단건 상태 (서버 검증 붙기 전 임시)
  const SUB_PRICE = 4900;                 // 월 구독 — 광고 없음 + 매일 운세 전체 + 잠긴 글
  const DEEP_PRICE = 19800;               // 단건 — 내 상황을 넣은 심층 상담
  // 모션을 줄여달라는 요청은 CSS 뿐 아니라 우리가 만들어 넣는 SVG 애니메이션에도 적용된다
  const REDUCED = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 이웃 모듈 ─────────────────────────────────────────
     doryeong.js 등은 `const Doryeong = ...` 로 선언한다.
     스크립트 최상위의 const 는 window 에 붙지 않으므로 DR 은 undefined 다.
     맨 나중에 실행되는 이 파일에서 전역 식별자로 직접 집어둔다. */
  const DR = typeof Doryeong !== 'undefined' ? Doryeong : null;
  const TP = typeof Topics !== 'undefined' ? Topics : null;
  const CS = typeof Consult !== 'undefined' ? Consult : null;
  const SIT = typeof Situation !== 'undefined' ? Situation : null;
  const SH = typeof Share !== 'undefined' ? Share : null;
  const CP = typeof Chapter !== 'undefined' ? Chapter : null;

  /* 긴 글은 "{이름}님은 지금 …" 으로 열린다.
     지금은 이름을 안 받는다. 빈 값이면 Chapter 가 그 덩어리째 지우고
     "지금 …" 으로 시작하게 만든다 — "님은 지금" 이 남지 않게.
     이름을 받기 시작하면 여기만 바꾸면 된다. */
  const NAME_KEY = 'ondoryeong.name.v1';
  const readerName = () => {
    try { return (localStorage.getItem(NAME_KEY) || '').trim().slice(0, 12); }
    catch (e) { return ''; }
  };

  /* ── 상태 ─────────────────────────────────────────────── */
  let chart = null;      // manseryeok 계산 결과
  let rp = null;         // report.js 조립 결과
  let session = null;    // consult 세션
  let picked = null;     // 상담에서 고른 주제

  /* ── 무엇을 열어줄 것인가 ─────────────────────────────────
     무료라도 훅(제목·왜 그런지)은 다 보여준다. 가리는 건 실용 정보다.
     "뭐가 있는지 모르는 것"은 궁금하지 않고, "거의 다 아는데 한 조각이 빈 것"이 궁금하다. */
  let ent = { sub: false, deep: false };
  function loadEnt() {
    try { ent = { ...ent, ...(JSON.parse(localStorage.getItem(PASS) || '{}')) }; } catch (e) {}
    return ent;
  }
  function saveEnt() { try { localStorage.setItem(PASS, JSON.stringify(ent)); } catch (e) {} }
  const opened = () => ent.sub || ent.deep;   // 구독이든 단건이든 열리면 다 열린다

  /* 가려진 칸. 실제 글자를 DOM에 넣지 않는다 —
     흐리게만 처리하면 개발자도구로 그대로 읽힌다. 길이만 흉내 낸 막대를 그린다. */
  function veil(text, opt = {}) {
    const n = Math.max(6, Math.min(64, [...String(text || '')].length));
    const rows = [];
    let left = n;
    while (left > 0) { rows.push(Math.min(left, 26)); left -= 26; }
    return `<span class="veiled" role="img" aria-label="${esc(opt.label || '구독하면 열리는 자리')}">${
      rows.map((w) => `<i style="width:${w}ch"></i>`).join('')}</span>`;
  }
  // 열려 있으면 글, 아니면 가린 자리
  const show = (text, label) => (opened() ? esc(text) : veil(text, { label }));

  /* ══════════════════════════════════════════════════════
     달력 — 음력이면 양력으로 바꾼다
     ══════════════════════════════════════════════════════ */
  function lunarToSolar(y, m, d, leap) {
    const K = window.KoreanLunarCalendar;
    if (!K) return null;
    try {
      const c = new K();
      if (!c.setLunarDate(y, m, d, !!leap)) return null;
      const s = c.getSolarCalendar();
      if (!s || !s.year) return null;
      return { year: s.year, month: s.month, day: s.day };
    } catch (e) { return null; }
  }

  function calMode() {
    const el = document.querySelector('input[name="cal"]:checked');
    return el ? el.value : 'solar';
  }

  // 폼에 적힌 값을 실제 계산에 쓸 양력 날짜로 정리한다.
  function readBirth() {
    const y = num($('f-year')), m = num($('f-month')), d = num($('f-day'));
    if (y == null || m == null || d == null) return { err: '태어난 해와 달과 날을 모두 적어주세요.' };
    if (m < 1 || m > 12) return { err: '달은 1에서 12 사이예요.' };
    if (d < 1 || d > 31) return { err: '날은 1에서 31 사이예요.' };

    const lunar = calMode() === 'lunar';
    const leap = lunar && $('f-leap').checked;
    let sol = { year: y, month: m, day: d };

    if (lunar) {
      const conv = lunarToSolar(y, m, d, leap);
      if (!conv) {
        return { err: leap
          ? `음력 ${y}년 ${m}월에는 윤달이 없어요. 윤달 표시를 풀고 다시 해보세요.`
          : `음력 ${y}년 ${m}월 ${d}일은 없는 날이에요. 다시 확인해 주세요.` };
      }
      sol = conv;
    } else {
      // 양력은 실제로 있는 날인지 확인 (2월 30일 같은 것)
      const t = new Date(Date.UTC(y, m - 1, d));
      if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) {
        return { err: `${y}년 ${m}월 ${d}일은 없는 날이에요.` };
      }
    }

    if (sol.year < 1900 || sol.year > 2050) {
      return { err: '지금은 1900년부터 2050년까지만 볼 수 있어요.' };
    }

    // 비워두면 조용히 정오로 잡아버리면 안 된다. 시주가 통째로 달라지는데
    // 사용자는 자기가 아는 시각으로 본 줄 안다. 채우게 하거나, 모른다고 말하게 한다.
    const unknownTime = $('f-unknown-time').checked;
    const rawH = num($('f-hour')), rawM = num($('f-minute'));
    if (!unknownTime && (rawH == null || rawM == null)) {
      return { err: '태어난 시각을 적어주세요. 모르시면 아래 "태어난 시각을 몰라요"에 표시해 주세요.' };
    }
    const hh = unknownTime ? 12 : rawH;
    const mm = unknownTime ? 0 : rawM;
    if (!unknownTime) {
      if (hh < 0 || hh > 23) return { err: '시각은 0시에서 23시 사이예요.' };
      if (mm < 0 || mm > 59) return { err: '분은 0에서 59 사이예요.' };
    }

    // 아직 오지 않은 날은 명식을 세울 수 없다.
    // 지금까지는 나이가 0개월로 눌려 멀쩡한 리포트가 나왔다.
    const bornKST = Date.UTC(sol.year, sol.month - 1, sol.day, hh, mm) - 9 * 3600 * 1000;
    if (bornKST > Date.now()) {
      return { err: '아직 오지 않은 날이에요. 태어난 날을 다시 확인해 주세요.' };
    }

    const g = document.querySelector('input[name="gender"]:checked');
    return {
      input: {
        year: sol.year, month: sol.month, day: sol.day,
        hour: hh, minute: mm,
        gender: g ? g.value : 'F',
        unknownTime,
        useTrueSolar: true,
      },
      raw: { cal: lunar ? 'lunar' : 'solar', y, m, d, leap, hh, mm, unknownTime, gender: g ? g.value : 'F' },
    };
  }

  // 음력을 적는 동안 양력이 무엇인지 바로 보여준다 — 이게 없으면 불안해서 못 넘어간다
  function syncConv() {
    const note = $('conv-note');
    const lunar = calMode() === 'lunar';
    $('leap-wrap').classList.toggle('hidden', !lunar);
    if (!lunar) { note.classList.add('hidden'); note.textContent = ''; return; }

    const y = num($('f-year')), m = num($('f-month')), d = num($('f-day'));
    if (y == null || m == null || d == null) { note.classList.add('hidden'); return; }
    const conv = lunarToSolar(y, m, d, $('f-leap').checked);
    note.classList.remove('hidden');
    note.textContent = conv
      ? `양력으로는 ${conv.year}년 ${conv.month}월 ${conv.day}일이에요.`
      : '그런 음력 날짜는 없어요. 윤달 표시도 함께 확인해 주세요.';
  }

  /* ══════════════════════════════════════════════════════
     문 앞
     ══════════════════════════════════════════════════════ */
  function mountGate() {
    if (DR) $('dr-gate').innerHTML = DR.media({ kind: 'idle', loop: true, label: '온도령' });

    ['f-year', 'f-month', 'f-day', 'f-leap'].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener('input', syncConv);
    });
    document.querySelectorAll('input[name="cal"]').forEach((r) =>
      r.addEventListener('change', syncConv));

    $('f-unknown-time').addEventListener('change', (e) => {
      $('time-row').classList.toggle('hidden', e.target.checked);
    });

    $('birth-form').addEventListener('submit', (e) => { e.preventDefault(); cast(); });
    syncConv();
  }

  function restore() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    if (!saved || !saved.cal) return false;
    try {
      document.querySelector(`input[name="cal"][value="${saved.cal}"]`).checked = true;
      $('f-year').value = saved.y; $('f-month').value = saved.m; $('f-day').value = saved.d;
      $('f-leap').checked = !!saved.leap;
      $('f-hour').value = saved.unknownTime ? '' : saved.hh;
      $('f-minute').value = saved.unknownTime ? '' : saved.mm;
      $('f-unknown-time').checked = !!saved.unknownTime;
      $('time-row').classList.toggle('hidden', !!saved.unknownTime);
      document.querySelector(`input[name="gender"][value="${saved.gender}"]`).checked = true;
      syncConv();
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════
     명식 세우기
     ══════════════════════════════════════════════════════ */
  async function cast(opt = {}) {
    const err = $('form-err');
    err.textContent = '';

    const got = readBirth();
    if (got.err) { err.textContent = got.err; $('f-year').focus(); return; }

    if (!opt.silent) showVeil();

    let c;
    try {
      c = Manse.compute(got.input);
    } catch (e) {
      hideVeil();
      err.textContent = doryeongSay(e);
      if (!opt.silent) err.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    chart = c;
    try { localStorage.setItem(STORE, JSON.stringify(got.raw)); } catch (e) { /* 저장 못 해도 진행 */ }

    rp = Report.build(chart, { unlocked: opened() });
    renderReport();

    if (!opt.silent) {
      await sleep(1100);   // 계산은 순식간이지만, 넘겨보는 시늉은 필요하다
      hideVeil();
    }

    $('gate').classList.add('hidden');
    $('report').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: opt.silent ? 'auto' : 'smooth' });
    observeReveal();
  }

  // 엔진은 중립적인 말투로 던진다. 화면에서 도령의 말로 옮긴다.
  function doryeongSay(e) {
    const m = (e && e.message) || '';
    if (m.includes('서머타임')) {
      return '그날은 서머타임이 시작되면서 그 시각이 통째로 건너뛰어졌어요. '
           + '실제로 없던 시각이라, 출생 기록을 한 번 더 확인해 주세요.';
    }
    if (m.includes('지원 범위')) return '지금은 1900년부터 2050년까지만 볼 수 있어요.';
    return '명식을 세우지 못했어요. 적어주신 날짜를 다시 확인해 주세요.';
  }

  const VEIL_LINES = ['어디 보자…', '절기를 짚어보는 중이네', '여덟 글자가 잡혔네'];
  let veilTimer = 0;

  function showVeil() {
    if (DR) $('dr-veil').innerHTML = DR.media({ kind: 'reading', loop: true, label: '만세력을 넘기는 온도령' });
    playIn($('dr-veil'));
    $('veil').classList.remove('hidden');
    let i = 0;
    $('veil-text').textContent = VEIL_LINES[0];
    clearInterval(veilTimer);
    veilTimer = setInterval(() => {
      i = (i + 1) % VEIL_LINES.length;
      $('veil-text').textContent = VEIL_LINES[i];
    }, 700);
  }
  function hideVeil() {
    clearInterval(veilTimer);
    $('veil').classList.add('hidden');
    $('dr-veil').innerHTML = '';
  }

  /* ══════════════════════════════════════════════════════
     풀이 — 각인
     ══════════════════════════════════════════════════════ */
  function renderBrand() {
    if (DR) $('dr-reveal').innerHTML = DR.media({ kind: 'reveal', loop: false, label: '' });

    $('rp-name').textContent = rp.type.name;
    $('rp-headline').textContent = rp.type.headline || rp.type.nounGloss;

    const st = rp.strength, ra = rp.rarity;
    const bits = [
      `<span class="stat">${esc(rp.type.stem)}일간 · <b>${esc(rp.type.season)}</b>에 남</span>`,
      `<span class="stat">${esc(st.label)}</span>`,
    ];
    // 자랑할 게 있을 때만 자랑한다 — "상위 50%"는 아무 말도 아니다
    if (ra.rare) bits.push(`<span class="stat">오행 치우침 상위 <b>${ra.percentile}%</b></span>`);
    else if (ra.balanced) bits.push(`<span class="stat">오행이 <b>고른</b> 편</span>`);
    bits.push(`<span class="stat">${rp.totalCharts.toLocaleString('ko-KR')}가지 중 하나</span>`);
    $('rp-stats').innerHTML = bits.join('');
  }

  /* ── 여덟 글자 ─────────────────────────────────────────── */
  function renderBoard() {
    const P = rp.chart.pillars;
    const order = [['year', '연주', '태어난 해'], ['month', '월주', '태어난 달'],
                   ['day', '일주', '나'], ['hour', '시주', '태어난 시']];

    /* 시각을 모르면 시주가 비어 여섯 글자가 된다.
       그런데 탭 이름은 '사주팔자' 고 설명은 '두 글자씩' 이라, 그 사람에게는
       화면이 고장난 것처럼 보인다. 세는 말을 실제 글자 수에 맞춘다. */
    const six = rp.glyphCount === 6;
    const sub = $('sub-saju');
    if (sub) {
      sub.textContent = six
        ? '태어난 해·달·날을 두 글자씩 옮긴 표예요. 시각을 몰라 시주 칸은 비어 있어요.'
        : '태어난 해·달·날·시를 두 글자씩 옮긴 표예요. 어느 기운이 많고 어느 게 비었는지까지.';
    }
    const ol = $('oheng-lead');
    if (ol) ol.textContent = `${six ? '여섯' : '여덟'} 글자에 숨은 기운까지 헤아려 무게를 달았어요.`;

    const col = (key, tag, sub) => {
      const p = P[key];
      if (!p) {
        return `<div class="col col-empty">
          <div class="col-tag">${esc(tag)}</div>
          <div class="glyph"><span class="glyph-han">?</span></div>
          <div class="glyph"><span class="glyph-han">?</span></div>
          <div class="col-sip">시각 미상</div><div class="col-hidden"></div></div>`;
      }
      const sc = EL_VAR(p.stemInfo.el), bc = EL_VAR(p.branchInfo.el);
      const hid = (p.branchInfo.hidden || []).map((i) => Manse.STEMS[i].han).join('');
      return `<div class="col${key === 'day' ? ' col-me' : ''}">
        <div class="col-tag">${esc(key === 'day' ? '일주 · 나' : tag)}</div>
        <div class="glyph glyph-stem" style="--gl:${sc}">
          <span class="glyph-han">${esc(p.stemInfo.han)}</span>
          <span class="glyph-kor">${esc(p.stemInfo.kor)}</span>
        </div>
        <div class="glyph glyph-branch" style="--gl:${bc}">
          <span class="glyph-han">${esc(p.branchInfo.han)}</span>
          <span class="glyph-kor">${esc(p.branchInfo.kor)}</span>
        </div>
        <div class="col-sip">${esc(p.stemSipseong || '')}</div>
        <div class="col-hidden">${esc(hid)}</div>
      </div>`;
    };

    $('board').innerHTML = order.map(([k, t, s]) => col(k, t, s)).join('');

    const m = rp.chart.meta;
    const notes = [];
    notes.push(`${m.sajuYear}년 ${esc(m.monthTerm)} 절입 이후에 태어나셨어요.`);
    if (m.assumedNoon) notes.push('시각을 몰라 시주는 비워뒀어요. 나머지 여섯 글자만으로도 큰 결은 읽혀요.');
    if (m.tzOffsetMin !== 540) notes.push(`태어난 해의 표준시가 지금과 달라(UTC+${(m.tzOffsetMin / 60).toFixed(1)}) 그만큼 보정했어요.`);
    if (m.boundaryWarning) notes.push(`절기(${esc(m.nearestTermName)})가 드는 시각과 ${m.nearestTermMin}분 차이예요. 태어난 시각이 조금만 달라도 기둥이 바뀌니 출생 기록을 한 번 확인해 보세요.`);
    else if (m.termDayWarning) notes.push(`절입일(${esc(m.nearestTermName)}) 근처에 태어나셨어요. 정확한 시각을 알면 더 또렷해져요.`);
    if (!m.precise) notes.push('천문 계산 라이브러리를 불러오지 못해 근사식으로 절기를 잡았어요. 경계에 가까우면 오차가 있을 수 있어요.');
    $('board-foot').innerHTML = notes.map(esc).join('<br>');
  }

  /* ── 기질 ─────────────────────────────────────────────── */
  /* 한 편의 긴 글로 그린다.
     예전엔 이 자리가 칸 다섯이었다 — 본문 / 이런 식이에요 / 잘하는 것 /
     자주 걸리는 곳 / 기운의 두께. 정보는 다 있는데 읽히지가 않아서
     "짧게 짧게라 의미가 없어 보인다" 는 말을 들었다.

     긴 글이 없는 명식은 아직 조각으로 그린다. 40장을 다 채우기 전에도
     화면이 비지 않아야 하기 때문이다. */
  function renderNature() {
    const t = rp.type, st = rp.strength;

    if (CP && t.chapter) {
      $('nature').innerHTML = CP.render(t.chapter, {
        open: opened(),
        values: { 물상: t.noun, 이름: readerName() },
        cta: `<button type="button" class="td-open" data-open="1">${
          SUB_PRICE.toLocaleString()}원으로 마저 읽기</button>`,
      })
      // 두께는 긴 글에 안 들어간다. 계산으로 나온 값이라 글과 성격이 다르다.
      + `<div class="np" style="--npc:var(--gold-ink)">
          <span class="np-label">기운의 두께 · ${esc(st.label)}</span>
          <span class="np-text">${esc(st.note)}</span>
          <span class="np-note">${esc(st.caveat)}</span></div>`;
      return;
    }

    const parts = [];
    if (t.body) parts.push(`<p class="nature-body">${esc(t.body)}</p>`);
    // 구체적인 장면 하나가 "어떻게 알았지" 하고 멈칫하게 만든다
    if (t.example) parts.push(`<p class="nature-eg"><i>이런 식이에요</i>${esc(t.example)}</p>`);
    parts.push(`<div class="nature-pair">`);
    if (t.strengthLine) {
      parts.push(`<div class="np" style="--npc:var(--el-0)">
        <span class="np-label">잘하는 것</span>
        <span class="np-text">${esc(t.strengthLine)}</span></div>`);
    }
    if (t.cautionLine) {
      parts.push(`<div class="np" style="--npc:var(--el-1)">
        <span class="np-label">자주 걸리는 곳</span>
        <span class="np-text">${esc(t.cautionLine)}</span></div>`);
    }
    parts.push(`<div class="np" style="--npc:var(--gold-ink)">
      <span class="np-label">기운의 두께 · ${esc(st.label)}</span>
      <span class="np-text">${esc(st.note)}</span>
      <span class="np-note">${esc(st.caveat)}</span></div>`);
    parts.push(`</div>`);
    $('nature').innerHTML = parts.join('');
  }

  /* ── 오행 저울 (오각형) ────────────────────────────────── */
  function renderOheng() {
    const el = rp.chart.elCount;
    const total = el.reduce((a, b) => a + b, 0) || 1;
    const max = Math.max(...el, 0.001);
    const R = 92, CX = 110, CY = 108;
    // 상생 순서대로 시계방향: 목 → 화 → 토 → 금 → 수
    const ang = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / 5);
    const pt = (i, r) => [CX + Math.cos(ang(i)) * r, CY + Math.sin(ang(i)) * r];

    const ring = (f) => Array.from({ length: 5 }, (_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
    const shape = Array.from({ length: 5 }, (_, i) =>
      pt(i, Math.max(0.1, el[i] / max) * R).map((v) => v.toFixed(1)).join(',')).join(' ');

    const grid = [0.25, 0.5, 0.75, 1].map((f) =>
      `<polygon points="${ring(f)}" fill="none" stroke="rgba(190,205,235,.13)" stroke-width="1"/>`).join('');
    const spokes = Array.from({ length: 5 }, (_, i) => {
      const [x, y] = pt(i, R);
      return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(190,205,235,.1)" stroke-width="1"/>`;
    }).join('');
    const dots = Array.from({ length: 5 }, (_, i) => {
      const [x, y] = pt(i, Math.max(0.1, el[i] / max) * R);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${EL_VAR(i)}"/>`;
    }).join('');
    const labels = Array.from({ length: 5 }, (_, i) => {
      const [x, y] = pt(i, R + 20);
      return `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle"
        font-size="15" fill="${EL_VAR(i)}" font-family="var(--serif)">${Manse.ELEMENTS[i].han}</text>`;
    }).join('');

    $('oheng').innerHTML = `
      <svg viewBox="0 0 220 216" role="img" aria-label="오행 분포 그림">
        ${grid}${spokes}
        <polygon points="${shape}" fill="rgba(198,161,91,.17)" stroke="var(--gold)" stroke-width="1.6" stroke-linejoin="round"/>
        ${dots}${labels}
      </svg>
      <div class="oheng-legend">${
        el.map((v, i) => `<div class="ol" style="--oc:${EL_VAR(i)}">
          <span class="ol-dot"></span>
          <span class="ol-han">${Manse.ELEMENTS[i].han}</span>
          <span class="ol-num">${Math.round(v / total * 100)}%</span>
        </div>`).join('')
      }</div>`;

    // 가장 두꺼운 기운과 비어 있는 기운을 짚어준다
    const maxI = el.indexOf(Math.max(...el));
    const none = el.map((v, i) => (v < 0.35 ? i : -1)).filter((i) => i >= 0);
    const L = (i) => `${Manse.ELEMENTS[i].han}(${Manse.ELEMENTS[i].kor})`;
    let s = `가장 두꺼운 기운은 ${L(maxI)}이에요.`;
    if (none.length) s += ` 반대로 ${none.map(L).join('과 ')}은 거의 비어 있어요. 없는 기운은 대개 밖에서 구하게 돼요 — 사람에게서든, 일에서든.`;
    else s += ' 크게 빈 자리가 없어서, 어느 쪽으로든 무리 없이 뻗을 수 있는 명식이에요.';
    $('oheng-foot').textContent = s;
  }

  /* ── 대운 곡선 ────────────────────────────────────────── */
  // Catmull-Rom 을 베지에로 — 점을 다 지나가는 부드러운 곡선이 필요하다.
  //
  // 다만 날것 그대로는 봉우리 바깥으로 튄다. 어느 구간이 앞뒤보다 유난히 높으면
  // 제어점이 두 끝점보다 더 위로 올라가서, 4점짜리 곡선이 100점을 넘거나 0점 아래로 내려간다.
  // (표본을 돌려 보면 -3.2 ~ 101.7 까지 벗어났다. 축 밖으로 삐져나온 그림이 된다.)
  // 베지에는 제어점들의 볼록껍질 안에 갇히므로, 제어점 y 를 구간의 두 끝값 사이로
  // 눌러두면 곡선이 절대 구간 밖으로 못 나간다.
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    const clampY = (y, a, b) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), y));
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6, p1[1], p2[1])];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6, p1[1], p2[1])];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function renderCurve() {
    const cv = rp.curve;
    // 좁은 화면에서 viewBox가 줄어들면 글자도 같이 줄어든다.
    // 350px 폭에서 읽히려면 viewBox 안에서 두 배쯤 키워둬야 한다.
    // 간지를 한자와 한글 두 줄로 걸어야 해서 위아래 여백을 더 준다
    const W = 640, H = 356, PL = 30, PR = 30, PT = 70, PB = 62;
    const maxAge = Math.max(90, cv[cv.length - 1].endAge + 1);
    const x = (ageM) => PL + (ageM / 12 / maxAge) * (W - PL - PR);
    const y = (s) => PT + (1 - s / 100) * (H - PT - PB);

    // 각 구간의 한가운데를 점으로 찍는다
    const pts = cv.map((p) => [x((p.startMonths + p.endMonths) / 2), y(p.score)]);
    const line = smoothPath(pts);
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(H - PB).toFixed(1)} L${pts[0][0].toFixed(1)},${(H - PB).toFixed(1)} Z`;

    const decades = [];
    for (let a = 0; a <= maxAge; a += 10) {
      decades.push(`<line x1="${x(a * 12).toFixed(1)}" y1="${PT}" x2="${x(a * 12).toFixed(1)}" y2="${H - PB}"
        stroke="rgba(190,205,235,.07)" stroke-width="1"/>
        <text x="${x(a * 12).toFixed(1)}" y="${H - PB + 26}" text-anchor="middle"
        font-size="17" fill="var(--paper-far)">${a}</text>`);
    }

    const curIdx = rp.current.idx;
    const marks = cv.map((p, i) => {
      const [px, py] = pts[i];
      const cur = i === curIdx;
      const c = EL_VAR(p.stemEl);
      // 간지를 열 개 모두 한 줄에 얹으면 붙어버린다 — 위아래로 엇갈려 건다.
      // 한자만 두면 못 읽는 사람이 많으니 바로 아래 한글을 함께 건다.
      const up = i % 2 === 0;
      const hanY = cur ? py - 38 : (up ? py - 34 : py + 32);
      const korY = hanY + (cur || up ? 17 : 17);
      // 바깥 svg 를 role="img" 로 두면 안쪽 버튼들이 표현용 자식으로 묻힌다.
      // group 으로 열어두고, 고른 상태는 aria-pressed 로 알린다.
      return `<g class="cv-pt" data-i="${i}" tabindex="0" role="button" aria-pressed="${cur ? 'true' : 'false'}"
                 aria-label="${esc(p.startAge)}세부터 ${esc(p.endAge)}세, ${esc(p.ganji)} ${esc(p.label)}">
        <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="22" fill="transparent"/>
        ${cur ? `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13" fill="rgba(235,209,153,.18)">${
          REDUCED ? '' : '<animate attributeName="r" values="10;17;10" dur="2.6s" repeatCount="indefinite"/>'}</circle>` : ''}
        <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${cur ? 7 : 4.6}"
          fill="${cur ? 'var(--gold-lit)' : c}"/>
        <text x="${px.toFixed(1)}" y="${hanY.toFixed(1)}" text-anchor="middle"
          font-size="${cur ? 23 : 19}" fill="${cur ? 'var(--gold-lit)' : 'var(--paper-dim)'}"
          font-family="var(--serif)">${esc(p.han)}</text>
        <text x="${px.toFixed(1)}" y="${korY.toFixed(1)}" text-anchor="middle"
          font-size="${cur ? 15 : 13}" fill="${cur ? 'var(--gold)' : 'var(--paper-far)'}"
          >${esc(p.ganji)}</text>
      </g>`;
    }).join('');

    $('curve').innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="열 해 단위 운의 흐름. 점을 고르면 그 시기 풀이가 아래에 나옵니다.">
        <defs>
          <linearGradient id="cvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(198,161,91,.30)"/>
            <stop offset="100%" stop-color="rgba(198,161,91,0)"/>
          </linearGradient>
        </defs>
        ${decades.join('')}
        <line x1="${PL}" y1="${y(50).toFixed(1)}" x2="${W - PR}" y2="${y(50).toFixed(1)}"
          stroke="rgba(190,205,235,.14)" stroke-dasharray="3 5" stroke-width="1"/>
        <path d="${area}" fill="url(#cvFill)"/>
        <path d="${line}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"/>
        ${marks}
        <text x="${PL}" y="${PT - 40}" font-size="16" fill="var(--paper-far)">↑ 기운이 밀어주는 때</text>
        <text x="${PL}" y="${H - 4}" font-size="15" fill="var(--paper-far)">나이(세)</text>
      </svg>`;

    $('curve').querySelectorAll('.cv-pt').forEach((g) => {
      const go = () => showCurvePoint(+g.dataset.i);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    showCurvePoint(curIdx);
  }

  function showCurvePoint(i) {
    const p = rp.curve[i];
    if (!p) return;
    // 대운은 아홉 구간까지만 세운다. 그보다 오래 사신 분에게
    // 마지막 구간을 "지금 여기"라 하면 거짓이 된다.
    const isNow = i === rp.current.idx && rp.current.status === 'current';
    const age = `${p.startAge}세 ~ ${p.endAge}세`;
    $('curve').querySelectorAll('.cv-pt').forEach((g) =>
      g.setAttribute('aria-pressed', String(+g.dataset.i === i)));
    $('curve-now').innerHTML = `
      <div class="cn-top">
        <span class="cn-ganji">${esc(p.han)}</span>
        <span class="cn-age">${esc(age)}${isNow ? ' · 지금 여기' : ''}</span>
        <span class="cn-label">${esc(p.label)}</span>
      </div>
      ${p.line ? `<p class="cn-line">${esc(p.line)}</p>` : ''}
      ${p.example ? `<p class="cn-eg"><i>이런 식이에요</i>${esc(p.example)}</p>` : ''}
      ${p.advice ? `<p class="cn-advice">${esc(p.advice)}</p>` : ''}
      ${rp.current.status === 'after' && i === rp.current.idx
        ? `<p class="cn-advice">여기까지가 이 만세력이 세워둔 아홉 마디예요. 그 너머를 걸어오셨네요.</p>` : ''}`;

    /* 이 십 년에 대한 긴 글.
       사용자가 경쟁사 화면을 보여주며 "이렇게 길게 써 달라" 고 한 자리가 여기다.
       cutAt 이 1인 이유 — 십 년 이야기는 한 문단만 주고 끊어야 궁금해진다.
       곡선의 다른 마디를 눌러 봐도 그 마디의 글이 따라온다. */
    const box = $('daeun-read');
    if (!box) return;
    box.innerHTML = (CP && p.chapter) ? CP.render(p.chapter, {
      open: opened(),
      // "경술(庚戌)" 꼴. 조사는 한글 쪽 소리로 붙는다 — josa.js 가 괄호를 떼고 본다.
      values: { 물상: rp.type.noun, 이름: readerName(), 대운간지: `${p.ganji}(${p.han})` },
      cta: `<button type="button" class="td-open" data-open="1">${
        SUB_PRICE.toLocaleString()}원으로 마저 읽기</button>`,
    }) : '';
  }

  /* ── 오늘 ─────────────────────────────────────────────────
     이 서비스에서 사람이 매일 돌아올 이유는 이 카드 하나뿐이다.
     그래서 리포트에서 가장 두꺼운 칸이고, 재방문자에겐 맨 위로 올라간다. */

  // 며칠째 오는지. 하루라도 건너뛰면 다시 1일부터.
  function bumpStreak(stamp) {
    let st = { last: null, n: 0 };
    try { st = JSON.parse(localStorage.getItem(STREAK) || 'null') || st; } catch (e) {}
    if (st.last === stamp) return st.n;
    const yest = (() => {
      const [y, m, d] = stamp.split('-').map(Number);
      const t = new Date(Date.UTC(y, m - 1, d - 1));
      return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    })();
    st = { last: stamp, n: st.last === yest ? st.n + 1 : 1 };
    try { localStorage.setItem(STREAK, JSON.stringify(st)); } catch (e) {}
    return st.n;
  }

  /* 오늘 하루를 큰 흐름 위에 얹는 칸.
     이게 없으면 하루가 일진 하나로만 정해져 60일마다 똑같이 돌아온다.
     이번 달과 올해를 얹어야 한 해를 넘긴다. (tools/measure_repeat.js) */
  function flowBlock() {
    const f = rp.flow;
    if (!f) return '';
    const tags = [];
    if (f.daeun) tags.push(`<span class="tf-tag"><b>${esc(f.daeun.han)}</b> 대운 · ${esc(f.daeun.label)}</span>`);
    if (f.year && f.year.han) {
      tags.push(`<span class="tf-tag"><b>${esc(f.year.han)}</b> ${f.year.year}년${
        f.year.label ? ' · ' + esc(f.year.label) : ''}</span>`);
    }
    if (f.month && f.month.han) tags.push(`<span class="tf-tag"><b>${esc(f.month.han)}</b>월 · ${esc(f.month.term)}</span>`);
    const body = [];
    if (f.month && f.month.line) body.push(`<p>${show(f.month.line, '이번 달 풀이')}</p>`);
    if (f.year && f.year.line) body.push(`<p class="tf-year">${show(f.year.line, '올해 풀이')}</p>`);
    if (!tags.length && !body.length) return '';
    return `<div class="td-flow">
      <i class="tf-label">지금 어디쯤인가</i>
      ${tags.length ? `<div class="tf-tags">${tags.join('')}</div>` : ''}
      ${body.join('')}
    </div>`;
  }

  /* 숫자를 먼저 던지고, 그 숫자가 어디서 나왔는지 통째로 연다.
     운세 앱이 점수 근거를 안 밝히는 건 밝힐 게 없어서다.
     우리는 절기를 초 단위로 잡는 엔진이 있으니, 여는 쪽이 유리하다. */
  function scoreBlock() {
    const s = rp.score;
    if (!s) return '';
    const row = (p) => {
      const d = p.delta;
      const sign = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      return `<div class="sc-row sc-${sign}">
        <span class="sc-d">${d > 0 ? '+' : ''}${d}</span>
        <span class="sc-t"><b>${esc(p.label)}</b>${esc(p.detail)}${
          p.why ? `<i>${esc(p.why)}</i>` : ''}</span>
      </div>`;
    };
    return `<div class="score">
      <div class="sc-head">
        <span class="sc-num">${s.score}</span>
        <span class="sc-band">${esc(s.band)}</span>
      </div>
      <details class="sc-why">
        <summary>왜 ${s.score}점인가요?</summary>
        <div class="sc-body">
          <div class="sc-row sc-base"><span class="sc-d">${s.base}</span><span class="sc-t"><b>기준점</b>여기서 더하고 뺍니다</span></div>
          ${s.parts.map(row).join('')}
          <p class="sc-note">${esc(s.weightNote)}</p>
          <p class="sc-note">${esc(s.strengthNote)}</p>
        </div>
      </details>
    </div>`;
  }

  /* 이번 주 — 오늘 하나만 보여주면 "그래서 이번 주는" 이 남는다 */
  function weekBlock() {
    const w = rp.week;
    if (!w) return '';
    // 점수는 25~80 사이에 모인다. 그대로 비율을 내면 막대가 다 비슷해져
    // 이레를 한눈에 보는 뜻이 없어진다. 그 구간을 0~100으로 펴서 보여준다.
    const H = (n) => Math.max(8, Math.min(100, Math.round((n - 22) / 58 * 100)));
    return `<div class="week">
      <div class="wk-head">
        <i>이번 이레</i>
        <span>가장 순한 날 <b>${w.best.month}/${w.best.date} ${w.best.weekday}</b></span>
      </div>
      <div class="wk-bars">${w.days.map((d) => `
        <div class="wk-day${d.isToday ? ' is-today' : ''}">
          <span class="wk-bar" style="height:${H(d.score)}%"></span>
          <span class="wk-n">${opened() || d.isToday ? d.score : ''}</span>
          <span class="wk-w">${esc(d.weekday)}</span>
        </div>`).join('')}</div>
      ${opened() ? '' : '<p class="wk-lock">이레치 점수는 구독하면 전부 보여요</p>'}
    </div>`;
  }

  function renderToday() {
    const t = rp.today;
    const tm = rp.tomorrow;
    // 일진은 KST 23시부터 다음 날로 넘어간다. 화면 날짜를 브라우저 로컬 오늘로 쓰면
    // 23:30 에 "8월 8일" 옆에 8월 9일 일진이 붙는다. 일진이 쓴 날짜를 그대로 쓴다.
    const [sy, sm, sd] = t.stamp.split('-').map(Number);
    const d = new Date(Date.UTC(sy, sm - 1, sd));
    const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
    const streak = bumpStreak(t.stamp);

    /* 오늘 화면만 긴 글을 앞세우지 않는다.
       코덱스와 합의한 자리다 — 매일 여는 화면은 1분 안에 핵심과 행동을 얻어야
       습관이 된다. 긴 글은 자주 안 바뀌는 기질·대운 쪽에 둔다.

       그렇다고 예전처럼 칸 열 개로 쪼개지도 않는다. 첫 문단 하나를 통으로 펴 두고,
       나머지는 접어서 더 읽고 싶은 사람만 열게 한다. 짧되 파편은 아니다. */
    const ch = t.chapter;
    const todayRead = (CP && ch) ? `
      ${ch.title ? `<h4 class="td-headline">${CP.bold(ch.title)}</h4>` : ''}
      <p class="td-why">${CP.bold(CP.fill(ch.paras[0] || '', { 물상: rp.type.noun, 이름: readerName(), 오늘간지: t.ganji + '일' }))}</p>
      ${ch.paras.length > 1 ? `<details class="td-read">
        <summary>오늘을 더 읽기 · ${ch.paras.length - 1}문단</summary>
        <div class="td-read-body">${CP.render({ paras: ch.paras.slice(1), cutAt: 1 }, {
          open: opened(),
          values: { 물상: rp.type.noun, 이름: readerName(), 오늘간지: t.ganji + '일' },
          cta: `<button type="button" class="td-open" id="btn-open-read">${
            SUB_PRICE.toLocaleString('ko-KR')}원으로 마저 읽기</button>`,
        })}</div>
      </details>` : ''}` : `
      ${t.headline ? `<p class="td-headline">${esc(t.headline)}</p>` : ''}
      ${t.why ? `<p class="td-why">${esc(t.why)}</p>` : ''}`;

    const three = [
      ['일·돈', t.work, 'w'],
      ['사람', t.people, 'p'],
      ['몸·마음', t.body, 'b'],
    ].filter(([, v]) => v);

    $('today').innerHTML = `
      <div class="td-top">
        <div class="td-ganji">${esc(t.han)}</div>
        <div class="td-meta">
          <span class="td-date">${sm}월 ${sd}일 ${wd}요일 · ${esc(t.ganji)}일</span>
          <span class="td-mood">${esc(t.mood || t.relation)}</span>
        </div>
        ${t.special && t.kindLabel ? `<span class="td-kind td-kind-${esc(t.kind)}">${esc(t.kindLabel)}</span>` : ''}
      </div>

      ${scoreBlock()}
      ${todayRead}
      ${t.air ? `<p class="td-air">${esc(t.air)}</p>` : ''}

      ${flowBlock()}
      ${weekBlock()}

      ${t.special && t.kindLine ? `<div class="td-kindbox">
        <p>${esc(t.kindLine)}</p>
        ${t.kindTip ? `<p class="td-kindtip">${show(t.kindTip, '오늘의 처방')}</p>` : ''}
      </div>` : ''}

      ${!ch && three.length ? `<div class="td-three">${three.map(([k, v, c], i) => `
        <div class="td-one td-one-${c}"><i>${esc(k)}</i><span>${
          i === 0 ? esc(v) : show(v, k + ' 풀이')}</span></div>`).join('')}</div>` : ''}

      ${t.bestTime ? `<div class="td-time">
        <i>잘 풀리는 때</i>
        ${opened() ? `<b>${esc(t.bestTime)}</b>${t.bestWhy ? `<span>${esc(t.bestWhy)}</span>` : ''}`
                   : veil(t.bestTime + (t.bestWhy || ''), { label: '잘 풀리는 시간대' })}
      </div>` : ''}

      <div class="td-acts">
        ${(ch && ch.doThis) || t.doThis ? `<div class="td-act"><i>오늘 해볼 것</i><span>${esc((ch && ch.doThis) || t.doThis)}</span></div>` : ''}
        ${(ch && ch.avoid) || t.avoid ? `<div class="td-act is-hold"><i>오늘 미뤄둘 것</i><span>${show((ch && ch.avoid) || t.avoid, '오늘 미뤄둘 일')}</span></div>` : ''}
      </div>

      ${!ch && t.watchFor ? `<p class="td-watch"><i>걸리기 쉬운 자리</i>${show(t.watchFor, '걸리기 쉬운 자리')}</p>` : ''}
      ${!ch && t.goodWith ? `<p class="td-good"><i>오늘 곁에 두면 좋은 사람</i>${show(t.goodWith, '곁에 두면 좋은 사람')}</p>` : ''}

      ${opened() ? '' : `<button type="button" class="td-open" id="btn-open-today">
        가려진 곳까지 매일 보기 · 달마다 ${SUB_PRICE.toLocaleString('ko-KR')}원
      </button>`}

      <div class="td-foot">
        ${streak > 1 ? `<span class="td-streak">${streak}일째 오셨네</span>` : ''}
        ${tm && tm.headline ? `<span class="td-tomorrow">내일은 ${esc(tm.ganji)}일 · ${
          opened() ? esc(tm.headline) : veil(tm.headline, { label: '내일 미리보기' })}</span>` : ''}
      </div>`;

  }

  /* 제목의 "[ 한 가지 ]" 를 빈칸으로 바꾸던 함수가 여기 있었다.
     카드 12장 목록이 사라지면서 쓰는 데가 없어져 지웠다.
     이제 가리는 일은 chapter.js 가 문단 단위로 한다. */

  /* ── 값 ───────────────────────────────────────────────
     예전엔 "아직 열지 않은 것" 이라는 카드 12장 목록과 결제 카드가 있었다.
     목록은 제 위에 있는 탭을 그대로 다시 부르는 것뿐이었고, 무료 4장의 바로가기는
     탭을 넣으면서 죽었다(숨은 탭을 가리켜 눌러도 아무 일이 없었다).
     목록을 걷어내고, 값은 화면 아래 한 줄로 눕혔다.
     가려진 글은 이제 각 탭 안에서 제자리에 가려진다 — 목록으로 셀 필요가 없다. */
  function renderPaybar() {
    const bar = $('paybar');
    if (!bar) return;
    bar.classList.toggle('hidden', opened());
    if (opened()) return;

    // 지금 이 탭에서 가려진 게 몇 군데인지 세어 문구에 담는다.
    // "가려진 게 있다" 를 숫자로 보여주면 막연한 광고보다 덜 미덥잖다.
    const n = document.querySelectorAll('.pane:not([hidden]) .cp-veil, .pane:not([hidden]) .veiled').length;
    // 390px 한 줄에 들어가야 한다. 길면 두 줄로 접혀 바가 두꺼워진다.
    $('paybar-lead').textContent = n ? `가려진 ${n}곳 열기` : '전체 풀이 열기';
    $('unlock-price').textContent = SUB_PRICE.toLocaleString('ko-KR') + '원';
    $('unlock-note').textContent =
      '결제는 아직 붙이는 중이라 지금은 눌러도 그냥 열려요.';
  }

  /* ── 재물 · 일 ─────────────────────────────────────────
     사용자가 "재물이야기나 사주팔자의 해석을 좀 더 구체적으로" 라고 한 자리다.
     글은 미리 지어뒀지만 어느 편을 고르는지는 엔진이 정한다 —
     재성이 얼마나 있고, 편재냐 정재냐, 만들어 내는 힘이 밀어주나, 나눠 갖는 모양인가.

     조건 문단(feeds/contest/strong/weak)은 본문 뒤에 얹는다.
     해당하는 사람에게만 나가야 해서 본문에 넣을 수 없다. */
  function renderReading(boxId, ch, addons, basis) {
    const box = $(boxId);
    if (!box) return;
    if (!CP || !ch) { box.innerHTML = ''; return; }

    const extra = (addons || []).filter(Boolean)
      .map((t) => `<p>${CP.bold(t)}</p>`).join('');

    box.innerHTML = CP.render(ch, {
      open: opened(),
      values: { 이름: readerName() },
      cta: `<button type="button" class="td-open" data-open="1">${
        SUB_PRICE.toLocaleString('ko-KR')}원으로 마저 읽기</button>`,
    })
      // 조건 문단은 잠겼을 때 함께 가린다. 본문 뒤에 붙는 것도 결국 유료분이다.
      + (extra && opened() ? `<div class="rd-add">${extra}</div>` : '')
      + (basis ? `<p class="rd-basis">${esc(basis)}</p>` : '');
  }

  function renderWealth() {
    const c = typeof Content !== 'undefined' ? Content : null;
    const lf = c && c.longform;
    const w = rp.wealth;
    if (!lf || !lf.wealth || !w) { $('wealth').innerHTML = ''; return; }
    const a = lf.wealthAddons || {};
    renderReading('wealth', lf.wealth[w.key], [
      w.feeds ? a.feeds : null,
      w.contest ? a.contest : null,
      w.strength === '신강' ? a.strong : w.strength === '신약' ? a.weak : null,
    ], a.basis);
  }

  function renderWork() {
    const c = typeof Content !== 'undefined' ? Content : null;
    const lf = c && c.longform;
    const k = rp.work;
    if (!lf || !lf.work || !k) { $('work').innerHTML = ''; return; }
    renderReading('work', lf.work[k.key], [], '');
  }

  /* ── 상담 초대 ───────────────────────────────────────── */
  function renderInvite() {
    if (DR) $('dr-ask').innerHTML = DR.media({ kind: 'bow', loop: false, label: '' });

    const T = TP;
    if (!T || !T.LIST) { $('ask-chips').innerHTML = ''; return; }
    // 주제를 다 늘어놓으면 또 고르는 일이 되어버린다. 넷만 보여준다.
    const some = T.LIST.slice(0, 4);
    $('ask-chips').innerHTML = some.map((t) =>
      `<button type="button" class="chip" data-topic="${esc(t.id)}">${esc(t.label || t.title || t.id)}</button>`).join('');
    $('ask-chips').querySelectorAll('.chip').forEach((b) =>
      b.addEventListener('click', () => { picked = b.dataset.topic; toConsult(); }));
  }

  // 오늘의 운을 어느 날짜로 그렸는지 — 자정을 넘기면 다시 그려야 한다
  let renderedStamp = null;

  /* ══════════════════════════════════════════════════════
     탭

     예전엔 一二三四五 번호가 붙은 일곱 덩이가 한 줄로 이어졌다.
     아래로 갈수록 힘이 빠졌고, 매일 오는 사람은 오늘까지 닿는 데 네 덩이를 지나야 했다.

     탭을 넷으로 나눈 대신, 자리는 고정하고 **처음 열리는 탭만** 사람에 따라 다르게 한다.
     자리까지 흔들면 어제 있던 게 오늘 없는 화면이 된다.
       처음 온 사람  → 타고난 성격.  "이게 나를 맞히나" 를 재는 자리가 여기다.
                       명식표는 증거지 훅이 아니다 — 한자 여덟 개가 첫 화면이면 그냥 나간다.
       다시 온 사람  → 오늘의 운수.  다시 온 이유가 그것 하나뿐이다.
     ══════════════════════════════════════════════════════ */
  const TABS = ['today', 'nature', 'saju', 'flow'];
  let activeTab = null;

  function showTab(id, opt = {}) {
    if (!TABS.includes(id)) id = TABS[0];
    if (id === activeTab && !opt.force) return;
    const prev = activeTab;
    activeTab = id;

    for (const t of TABS) {
      const btn = $(`tab-${t}`), pane = $(`pane-${t}`);
      if (!btn || !pane) continue;
      const on = t === id;
      btn.setAttribute('aria-selected', String(on));
      // 안 열린 탭은 탭 순회에서 빠져야 한다. 화살표로만 옮기는 게 표준이다.
      btn.tabIndex = on ? 0 : -1;
      pane.hidden = !on;
    }

    // 탭 막대를 눌러 옮긴 경우에만 위로 올린다.
    // 되살아나며 그리는 경우(처음 진입·자정 갱신)까지 올리면 읽던 자리를 잃는다.
    if (prev !== null && !opt.keepScroll) {
      const bar = $('tabs');
      if (bar) window.scrollTo({ top: Math.max(0, bar.offsetTop - 8), behavior: 'instant' });
    }
    // 새로 뜬 판의 애니메이션을 다시 걸어준다 — 숨어 있던 동안은 관찰이 안 됐다.
    observeReveal();
    // 가려진 곳 수는 탭마다 다르다. 판을 바꿨으니 다시 센다.
    if (rp) renderPaybar();
  }

  function wireTabs() {
    const bar = $('tabs');
    if (!bar) return;
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) showTab(b.dataset.tab);
    });
    // 좌우 화살표로 옮기고 Home/End 로 양 끝. 탭 위젯의 표준 조작이다.
    bar.addEventListener('keydown', (e) => {
      const i = TABS.indexOf(activeTab);
      let n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = TABS.length - 1;
      if (n < 0) return;
      e.preventDefault();
      showTab(TABS[n]);
      $(`tab-${TABS[n]}`).focus();
    });
  }

  function renderReport() {
    renderedStamp = Report.dayStamp();
    renderBrand();
    renderBoard();
    renderNature();
    renderOheng();
    renderCurve();
    renderToday();
    renderWealth();
    renderWork();
    renderPaybar();
    renderInvite();
    $('cs-name').textContent = rp.type.name;
    // 아직 어느 탭도 안 열렸으면 첫 방문이다. "이게 나를 맞히나" 를 재는 자리로 연다.
    if (activeTab === null) showTab('nature', { keepScroll: true, force: true });
  }

  // 탭을 켜둔 채 자정을 넘기면 어제 운세가 그대로 남는다.
  // 매일 다시 오게 만드는 게 이 화면의 유일한 재방문 장치이므로, 여기가 틀리면 안 된다.
  function refreshIfNewDay() {
    if (!chart || !rp || document.hidden) return;
    if (Report.dayStamp() === renderedStamp) return;
    rp = Report.build(chart, { unlocked: opened() });
    renderedStamp = Report.dayStamp();
    renderToday();
    renderCurve();          // 해가 바뀌면 세운도, 나이가 차면 대운 구간도 달라진다
    renderBrand();
  }

  /* ══════════════════════════════════════════════════════
     내 상황 — 19,800원짜리 풀이의 알맹이
     ══════════════════════════════════════════════════════ */
  let sit = {};   // 사용자가 채운 여덟 가지

  function renderSituation() {
    if (!SIT) return;
    $('sit-fields').innerHTML = SIT.FIELDS.map((f, i) => {
      const head = `<div class="sit-q">
        <span class="sit-n">${i + 1}</span>
        <div>
          <label class="sit-label" ${f.type === 'text' ? `for="sit-${f.id}"` : ''}>${esc(f.q)}${
            f.required ? '' : ' <em>건너뛰어도 되네</em>'}</label>
          ${f.hint ? `<p class="sit-hint">${esc(f.hint)}</p>` : ''}
        </div>
      </div>`;

      if (f.type === 'text') {
        return `<div class="sit-item" data-id="${esc(f.id)}">${head}
          <textarea id="sit-${esc(f.id)}" rows="${f.rows || 3}"
            placeholder="${esc(f.placeholder || '')}"></textarea></div>`;
      }
      const multi = f.type === 'multi';
      return `<div class="sit-item" data-id="${esc(f.id)}">${head}
        <div class="sit-opts" role="${multi ? 'group' : 'radiogroup'}">${
          f.options.map(([k, v]) =>
            `<button type="button" class="sit-opt" data-k="${esc(k)}">${esc(v)}</button>`).join('')
        }</div>
        ${f.other ? `<input type="text" class="sit-other" id="sit-workYears"
          placeholder="${esc(f.other)}">` : ''}</div>`;
    }).join('');

    $('sit-fields').querySelectorAll('.sit-item').forEach((box) => {
      const id = box.dataset.id;
      const f = SIT.FIELDS.find((x) => x.id === id);
      const ta = box.querySelector('textarea');
      if (ta) { ta.addEventListener('input', () => { sit[id] = ta.value; syncSitCount(); }); return; }
      box.querySelectorAll('.sit-opt').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (f.type === 'multi') {
          const cur = new Set(sit[id] || []);
          // "별일 없었다"와 나머지는 같이 고를 수 없다
          if (k === 'none') { cur.clear(); cur.add('none'); }
          else { cur.delete('none'); cur.has(k) ? cur.delete(k) : cur.add(k); }
          sit[id] = [...cur];
          box.querySelectorAll('.sit-opt').forEach((x) => x.classList.toggle('on', cur.has(x.dataset.k)));
        } else {
          sit[id] = sit[id] === k ? undefined : k;   // 다시 누르면 해제 — 건너뛸 수 있어야 하니까
          box.querySelectorAll('.sit-opt').forEach((x) => x.classList.toggle('on', sit[id] === x.dataset.k));
        }
        syncSitCount();
      }));
      const other = box.querySelector('.sit-other');
      if (other) other.addEventListener('input', () => { sit.workYears = other.value; });
    });
    syncSitCount();
  }

  function syncSitCount() {
    if (!SIT) return;
    const n = SIT.filled(sit);
    $('sit-count').textContent = `여덟 가지 중 ${n}가지 답하셨네`;
  }

  function toSituation() {
    ['report', 'consult', 'gate'].forEach((k) => $(k).classList.add('hidden'));
    $('step-situation').classList.remove('hidden');
    if (!$('sit-fields').children.length) renderSituation();
    window.scrollTo({ top: 0, behavior: 'auto' });
    $('sit-err').textContent = '';
  }

  /* ══════════════════════════════════════════════════════
     상담
     ══════════════════════════════════════════════════════ */
  function toConsult() {
    $('report').classList.add('hidden');
    $('consult').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (!session) startConsult();
    else if (picked) sendTopic(picked);
    $('f-ask').focus();
  }

  function startConsult() {
    const Cs = CS;
    if (!Cs) return;
    // Consult.start 는 { topic, chart, ageMonths, ... } 를 받는다.
    // ageMonths 를 빼먹으면 currentDaeun 이 'after' 로 떨어져 늘 마지막 대운을 말하게 된다.
    session = Cs.start({
      topic: picked, chart, ageMonths: rp.ageMonths,
      situation: (sit && sit.concern) || '',
      // 여덟 가지는 그대로 넘긴다. 서버가 붙으면 이게 프롬프트의 알맹이가 된다.
      profile: SIT ? SIT.pack(sit) : null,
      care: SIT ? SIT.careFlags(sit) : [],
    });
    $('chat').innerHTML = '';

    const T = TP;
    if (T && T.LIST) {
      $('topic-strip').innerHTML = T.LIST.map((t) =>
        `<button type="button" class="chip${t.id === picked ? ' on' : ''}" data-topic="${esc(t.id)}">${esc(t.label || t.title || t.id)}</button>`).join('');
      $('topic-strip').querySelectorAll('.chip').forEach((b) =>
        b.addEventListener('click', () => {
          picked = b.dataset.topic;
          $('topic-strip').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
          sendTopic(picked);
        }));
    }

    const open = Cs.opening ? Cs.opening(session) : null;
    say('dr', open || `${rp.type.name}. 명식은 그렇게 읽혀요. 무엇이 마음에 걸리시나요?`);
    syncTurns();
  }

  function sendTopic(id) {
    const T = TP;
    const t = T && T.byId ? T.byId(id) : null;
    if (!t) return;
    // 세션이 들고 있는 건 id 가 아니라 주제 객체다
    if (session) session.topic = t;
    say('dr', t.probe || '그 이야기를 좀 더 들려주세요.');
    syncTurns();
  }

  function say(role, text, opt = {}) {
    const wrap = document.createElement('div');
    wrap.className = `turn turn-${role === 'me' ? 'me' : 'dr'}${opt.halt ? ' turn-halt' : ''}`;
    wrap.innerHTML = `<span class="turn-who">${role === 'me' ? '나' : '온도령'}</span>
      <div class="bubble">${esc(text)}</div>`;
    $('chat').appendChild(wrap);
    wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return wrap;
  }

  function thinking() {
    const wrap = document.createElement('div');
    wrap.className = 'turn turn-dr';
    wrap.innerHTML = `<span class="turn-who">온도령</span>
      <div class="bubble"><span class="dots"><span></span><span></span><span></span></span></div>`;
    $('chat').appendChild(wrap);
    wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return wrap;
  }

  function syncTurns() {
    const Cs = CS;
    if (!Cs || !session) return;
    const left = Cs.remaining ? Cs.remaining(session) : 0;
    $('turns-left').textContent = left > 0 ? `${left}번 더 물을 수 있어요` : '이번 몫은 여기까지예요';
    const out = left <= 0;
    $('pass-box').classList.toggle('hidden', !out);
    if (out) {
      $('pass-copy').textContent = '여기까지가 그냥 들어드릴 수 있는 몫이에요. 더 깊이 들어가려면 한 걸음 더 필요해요.';
      $('pass-note').textContent = '구독하시면 한 달에 한 번, 이어서 깊이 물을 수 있어요. 결제는 준비 중이라 지금은 눌러도 그냥 열려요.';
    }
    $('btn-ask').disabled = out;
    $('f-ask').disabled = out;
  }

  async function onAsk(e) {
    e.preventDefault();
    const ta = $('f-ask');
    const text = ta.value.trim();
    if (!text || !session) return;
    ta.value = ''; ta.style.height = 'auto';
    say('me', text);

    const busy = thinking();
    let res;
    try {
      res = await CS.ask(session, text);
    } catch (err) {
      busy.remove();
      say('dr', '죄송해요, 지금은 답을 잇지 못하겠어요. 조금 뒤에 다시 물어봐 주세요.');
      return;
    }
    busy.remove();
    say('dr', res && res.text ? res.text : '…', { halt: res && res.halt });
    syncTurns();
  }

  /* ══════════════════════════════════════════════════════
     영상 — 보일 때만 튼다
     ══════════════════════════════════════════════════════ */
  const started = new WeakSet();
  const ONCE_RATIO = 0.35;

  function playIn(host) {
    if (!host) return;
    host.querySelectorAll('video.dr-media').forEach((v) => {
      const frame = v.closest('.dr-frame');
      const p = v.play();
      if (p && p.catch) p.catch(() => { /* 자동재생 막히면 정지 그림 그대로 */ });
      if (frame) frame.classList.add('playing');
    });
  }
  function pauseIn(host) {
    if (!host) return;
    host.querySelectorAll('video.dr-media').forEach((v) => { try { v.pause(); } catch (e) {} });
  }

  function observeVideos() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.dr-frame').forEach((f) => playIn(f.parentElement || f));
      return;
    }
    const io = new IntersectionObserver((rows) => {
      rows.forEach((r) => {
        const frame = r.target;
        const v = frame.querySelector('video.dr-media');
        if (!v) return;
        const once = !v.loop;
        if (r.isIntersecting && r.intersectionRatio >= ONCE_RATIO) {
          if (once && started.has(v)) return;
          if (once) started.add(v);
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
          frame.classList.add('playing');
        } else if (!once) {
          try { v.pause(); } catch (e) {}
        }
      });
    }, { threshold: [0, ONCE_RATIO, 0.8] });
    document.querySelectorAll('.dr-frame').forEach((f) => io.observe(f));
  }

  /* ── 스크롤 진입 ─────────────────────────────────────── */
  let revealIO = null;
  function observeReveal() {
    const items = document.querySelectorAll('#report .reveal:not(.seen)');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('seen'));
      observeVideos();
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver((rows) => {
        rows.forEach((r) => {
          if (r.isIntersecting) { r.target.classList.add('seen'); revealIO.unobserve(r.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }
    items.forEach((el) => revealIO.observe(el));
    observeVideos();
  }

  /* ══════════════════════════════════════════════════════
     묶기
     ══════════════════════════════════════════════════════ */
  function bind() {
    $('btn-to-consult').addEventListener('click', () => toConsult());
    $('btn-back-report').addEventListener('click', () => {
      $('consult').classList.add('hidden');
      $('report').classList.remove('hidden');
      document.getElementById('sec-ask').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    $('btn-unlock').addEventListener('click', () => {
      ent.sub = !ent.sub;            // 결제가 붙기 전까지는 그냥 켜고 끈다
      saveEnt();
      rp = Report.build(chart, { unlocked: opened() });
      renderReport();
      const bar = $('tabs');
      if (bar) window.scrollTo({ top: Math.max(0, bar.offsetTop - 8), behavior: 'smooth' });
    });

    /* 가려진 자리를 여는 단추(.td-open)는 글 안에서 만들어진다.
       기질·대운·오늘·오늘더읽기 네 곳인데, 다시 그릴 때마다 사라졌다 새로 생긴다.
       그래서 하나씩 붙이면 안 된다 — 실제로 그렇게 두었다가 네 개 중 하나만
       살아 있었다. 나머지 셋은 눌러도 아무 일이 없었다.
       #report 에 한 번만 걸어두면 몇 번을 다시 그려도 계속 듣는다. */
    $('report').addEventListener('click', (e) => {
      const b = e.target.closest('.td-open');
      if (!b) return;
      $('btn-unlock').click();
    });

    // 한 번에 제대로 — 내 사정을 받아 그 위에 명식을 얹는 자리.
    // 미리 지어둔 글로는 못 하는 것이라 여기만 값이 다르다.
    // 19,800원은 "내 이야기를 듣고 쓰는 풀이"다. 먼저 이야기를 받는다.
    // 19,800원 단건은 접었다(월 4,900원 하나로 간다). 단추가 화면에 없어 연결하지 않는다.
    $('btn-sit-back').addEventListener('click', () => {
      $('step-situation').classList.add('hidden');
      $('report').classList.remove('hidden');
      $('paybar').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    $('sit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = SIT && SIT.validate(sit);
      if (bad) { $('sit-err').textContent = bad; $('sit-' + SIT.FIELDS[0].id).focus(); return; }
      ent.deep = true;                       // 결제가 붙기 전까지는 그냥 연다
      saveEnt();
      rp = Report.build(chart, { unlocked: opened() });
      renderReport();
      $('step-situation').classList.add('hidden');
      picked = null;
      session = null;                        // 사정이 새로 들어왔으니 상담을 다시 연다
      toConsult();
    });

    $('btn-pass').addEventListener('click', () => {
      if (CS && CS.grantPass) CS.grantPass(session);
      $('pass-box').classList.add('hidden');
      syncTurns();
      $('f-ask').focus();
    });

    $('btn-reset').addEventListener('click', () => {
      try { localStorage.removeItem(STORE); } catch (e) {}
      chart = null; rp = null; session = null; picked = null;
      $('report').classList.add('hidden');
      $('consult').classList.add('hidden');
      $('resume-bar').classList.add('hidden');
      activeTab = null;         // 다음 사람은 다시 첫 방문이다
      $('gate').classList.remove('hidden');
      document.querySelectorAll('#report .reveal').forEach((el) => el.classList.remove('seen'));
      $('birth-form').reset();
      $('time-row').classList.remove('hidden');
      syncConv();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('btn-share').addEventListener('click', share);
    $('btn-resume-new').addEventListener('click', () => $('btn-reset').click());

    document.addEventListener('visibilitychange', refreshIfNewDay);
    window.addEventListener('focus', refreshIfNewDay);
    setInterval(refreshIfNewDay, 60000);

    $('ask-form').addEventListener('submit', onAsk);
    const ta = $('f-ask');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'; });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('ask-form').requestSubmit(); }
    });
  }

  async function share() {
    if (!rp || !SH) return;
    const b = $('btn-share');
    const old = b.textContent;
    // 링크에 실리는 건 유형 이름 하나뿐이다. 생년월일은 URL 로 절대 나가지 않는다.
    const how = await SH.send(rp);
    const said = { copy: '링크를 복사했네', fail: '복사가 막혔네' }[how];
    if (said) { b.textContent = said; setTimeout(() => { b.textContent = old; }, 1800); }
  }

  /* ── 시작 ─────────────────────────────────────────────── */
  function boot() {
    if (typeof Manse === 'undefined') return;
    if (window.Astronomy && Manse.setAstro) Manse.setAstro(window.Astronomy);
    loadEnt();          // 구독·단건 상태를 되살린다. 이게 없으면 새로고침마다 다시 잠긴다.
    mountGate();
    bind();
    wireTabs();
    observeVideos();

    // 친구가 보낸 링크로 들어왔다면 그 유형을 먼저 보여준다.
    // 링크에는 유형 이름뿐이라 보낸 사람이 누구인지는 알 수 없다.
    const from = SH && SH.incoming();
    if (from) {
      $('fl-name').textContent = from;
      $('from-link').classList.remove('hidden');
    }

    // 전에 왔던 사람은 문 앞에 다시 세우지 않는다. 다만 같은 기기를 나눠 쓰는 일이
    // 있으니, 되살렸다는 사실과 지우는 길을 화면 맨 위에 밝혀둔다.
    if (restore()) {
      cast({ silent: true }).then(() => {
        if (!rp) return;
        $('resume-bar').classList.remove('hidden');
        // 저장된 명식이 되살아났다는 건 전에 왔던 사람이라는 뜻이다.
        // 다시 온 이유는 오늘 하나뿐이니 오늘 탭으로 연다.
        showTab('today', { keepScroll: true, force: true });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
