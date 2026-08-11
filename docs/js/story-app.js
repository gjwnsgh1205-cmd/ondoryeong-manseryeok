/* ============================================================
   story-app.js — 화면을 굴린다.

   흐름:  영상부(입장·이름·생일) → 명경 로딩 → 웹툰부
   계산은 전부 이 기기 안에서 한다. 생년월일은 서버로도 주소로도 나가지 않는다.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const J = typeof Josa !== 'undefined' ? Josa : null;
  const REDUCED = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STORE = 'saju.story.v1';
  let chart = null, rp = null, reader = '';

  /* ── 명경 로딩 ────────────────────────────────────
     index.html 쪽에서 검증한 연출을 그대로 옮겼다.
     이름이 한 자씩 찍히고, 여덟 글자가 하나씩 새겨진다. */
  let veilTimer = 0, typeTimer = 0;

  function typeInto(el, text, total) {
    clearTimeout(typeTimer);
    const chars = [...String(text)];
    if (REDUCED) { el.textContent = text; return; }
    el.textContent = '';
    const per = Math.max(60, Math.min(180, Math.floor(total * 0.55 / chars.length)));
    let i = 0;
    const tick = () => {
      el.textContent += chars[i]; i += 1;
      if (i < chars.length) typeTimer = setTimeout(tick, per);
    };
    tick();
  }

  function carveInto(box, glyphs) {
    box.innerHTML = glyphs.map((g, n) => `
      <span class="carve-col">
        <b style="--d:${n * 180}ms">${esc(g.top)}</b>
        <b style="--d:${(glyphs.length + n) * 180}ms">${esc(g.bot)}</b>
      </span>`).join('');
  }

  function veilRows(c) {
    const P = c.pillars, m = c.meta || {};
    const rows = [];
    if (reader) rows.push({ kind: 'type', t: reader, ms: 1500 });
    else rows.push({ t: '어디 보자…', ms: 1000 });
    rows.push({ t: `${c.input.year}년 ${c.input.month}월 ${c.input.day}일이라…`, ms: 1000 });
    if (m.monthTerm) {
      rows.push({ t: J ? J.fill('{절기}를 지났군', { 절기: m.monthTerm }) : m.monthTerm, ms: 1300 });
    }
    const cols = ['year', 'month', 'day', 'hour'].filter((k) => P[k])
      .map((k) => ({ top: P[k].stemInfo.han, bot: P[k].branchInfo.han }));
    rows.push({ kind: 'carve', glyphs: cols,
      t: `${cols.length === 4 ? '여덟' : '여섯'} 글자가 잡혔네`,
      ms: 900 + cols.length * 2 * 180 + 700 });
    rows.push({ t: '이제 하나씩 보자', ms: 1200 });
    return rows;
  }

  function showVeil(c) {
    $('veil').classList.remove('hidden');
    const rows = veilRows(c);
    const total = rows.reduce((a, r) => a + r.ms, 0);
    const carve = $('veil-carve');
    carve.innerHTML = '';
    let i = 0;
    const step = () => {
      const r = rows[i], el = $('veil-text');
      if (r.kind === 'type') typeInto(el, r.t, r.ms); else el.textContent = r.t;
      el.classList.toggle('is-name', r.kind === 'type');
      el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
      if (r.kind === 'carve') carveInto(carve, r.glyphs);
      i += 1;
      if (i < rows.length) veilTimer = setTimeout(step, r.ms);
    };
    clearTimeout(veilTimer); step();
    return total;
  }

  const hideVeil = () => {
    clearTimeout(veilTimer); clearTimeout(typeTimer);
    $('veil').classList.add('hidden');
    $('veil-carve').innerHTML = '';
  };

  /* ── 진행 막대 ──────────────────────────────────
     4만 자는 끝이 안 보이면 무섭다. 얼마나 왔는지만 알려준다. */
  function watchScroll() {
    const fill = $('bar-fill');
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = (h > 0 ? Math.min(100, window.scrollY / h * 100) : 0) + '%';
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    on();
  }

  /* ── 그리기 ─────────────────────────────────────── */
  async function cast(got) {
    reader = got.name || '';
    const b = got.birth;

    let input = {
      year: b.year, month: b.month, day: b.day,
      hour: b.unknownTime ? 12 : (b.hour == null ? 12 : b.hour),
      minute: b.unknownTime ? 0 : (b.minute == null ? 0 : b.minute),
      gender: b.gender, useTrueSolar: false,
      unknownTime: !!b.unknownTime,
    };

    // 음력이면 양력으로 옮긴다. 못 옮기면 그대로 간다.
    if (b.calendar === 'lunar' && window.KoreanLunarCalendar) {
      try {
        const k = new window.KoreanLunarCalendar();
        if (k.setLunarDate(b.year, b.month, b.day, false)) {
          const s = k.getSolarCalendar();
          input.year = s.year; input.month = s.month; input.day = s.day;
        }
      } catch (e) { /* 못 옮기면 양력으로 본다 */ }
    }

    try { chart = Manse.compute(input); }
    catch (e) { alert('그 날짜는 아직 못 봐요. 1900~2050년 사이로 넣어주세요.'); return; }
    chart.input.calendar = b.calendar;

    const wait = showVeil(chart);
    rp = Report.build(chart, { unlocked: true });

    // 유료분이 있으면 받아 온다. 없어도 화면은 성립한다.
    let paid = {};
    try { paid = await loadPaid(); } catch (e) {}

    const cuts = Story.build(rp, { paid });
    Toon.render($('toon'), cuts, slots());

    try { localStorage.setItem(STORE, JSON.stringify({ name: reader, birth: b })); } catch (e) {}

    await sleep(wait);
    hideVeil();
    $('intro').classList.add('hidden');
    $('toon').classList.remove('hidden');
    $('foot').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
    wireCard();
  }

  /* 글에 박힌 슬롯을 채운다.
     129편이 실제로 쓰는 슬롯은 아홉이다(tools 로 전수 확인).
     하나라도 빠뜨리면 화면에 "{물상}" 이 그대로 뜬다 — 실제로 한 번 걸렸다.
       {물상} 121  {이름} 55  {오늘간지} 10  {대운간지} 10
       {올해간지} 6  {올해} 4  {남은해} 2  {다음간지} 1  {갈아탈해} 1 */
  function slots() {
    const cur = rp.curve && rp.curve[rp.current.idx];
    const t = rp.turning;
    const y = rp.flow && rp.flow.year;
    const today = rp.today;
    return {
      물상: rp.type.noun,
      이름: reader,
      생년월일: `${chart.input.year}년 ${chart.input.month}월 ${chart.input.day}일`,
      대운간지: cur ? `${cur.ganji}(${cur.han})` : '',
      올해간지: y && y.ganji ? `${y.ganji}(${y.han})` : '',
      올해: y && y.year ? String(y.year) : String(new Date().getFullYear()),
      오늘간지: today && today.ganji ? `${today.ganji}일` : '',
      남은해: t ? String(Math.max(1, t.leftYears)) : '',
      갈아탈해: t ? String(t.year) : '',
      다음간지: t ? `${t.ganji}(${t.han})` : '',
    };
  }

  function loadPaid() {
    if (typeof ContentPaid !== 'undefined') return Promise.resolve(ContentPaid);
    return new Promise((done) => {
      const s = document.createElement('script');
      s.src = 'js/content-paid.js';
      s.onload = () => done(typeof ContentPaid !== 'undefined' ? ContentPaid : {});
      s.onerror = () => done({});
      document.head.appendChild(s);
    });
  }

  /* 마지막 주인공 카드를 그림으로 저장한다. 카톡에 그대로 올릴 수 있어야 한다 —
     남의 카드를 보고 "내 것도" 가 되는 게 유입 경로다. */
  function wireCard() {
    const btn = $('btn-card-save');
    if (!btn) return;
    btn.onclick = async () => {
      const card = btn.previousElementSibling;
      if (!card) return;
      btn.textContent = '만드는 중…';
      try {
        const png = await cardToPng(card);
        const a = document.createElement('a');
        a.href = png;
        a.download = `${reader || '사주'}-사주한편.png`;
        a.click();
        btn.textContent = '저장했어요';
      } catch (e) {
        btn.textContent = '길게 눌러 저장해 주세요';
      }
      setTimeout(() => { btn.textContent = '이 장면 간직하기'; }, 2600);
    };
  }

  /* canvas 로 카드 한 장을 그린다. 외부 라이브러리를 쓰지 않는다 —
     정적 사이트라 무게를 늘릴 이유가 없다. */
  function cardToPng(el) {
    const W = 880, H = 1180;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');

    x.fillStyle = '#0B0B0F'; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(W / 2, H * .3, 40, W / 2, H * .3, W * .8);
    g.addColorStop(0, 'rgba(198,161,91,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    x.strokeStyle = 'rgba(198,161,91,.45)'; x.lineWidth = 2;
    x.strokeRect(46, 46, W - 92, H - 92);

    const P = rp.chart.pillars;
    const cols = ['year', 'month', 'day', 'hour'].filter((k) => P[k]);
    const mid = W / 2;
    x.textAlign = 'center';

    x.fillStyle = '#F4EFE4'; x.font = '600 84px "Nanum Myeongjo", serif';
    x.fillText([...(reader || '')].join(' '), mid, 250);

    x.fillStyle = '#E9C87A'; x.font = '400 38px system-ui, sans-serif';
    const ci = rp.chart.input;
    x.fillText(`${ci.year}. ${String(ci.month).padStart(2, '0')}. ${String(ci.day).padStart(2, '0')}.`, mid, 322);

    // 여덟 글자
    const bw = 92, gap = 18;
    const startX = mid - (cols.length * bw + (cols.length - 1) * gap) / 2;
    cols.forEach((k, n) => {
      const cx = startX + n * (bw + gap);
      [P[k].stemInfo.han, P[k].branchInfo.han].forEach((ch, row) => {
        const cy = 420 + row * (bw + gap);
        x.fillStyle = 'rgba(198,161,91,.12)';
        x.fillRect(cx, cy, bw, bw);
        x.strokeStyle = 'rgba(198,161,91,.3)'; x.lineWidth = 1;
        x.strokeRect(cx, cy, bw, bw);
        x.fillStyle = '#E9C87A'; x.font = '400 52px "Nanum Myeongjo", serif';
        x.fillText(ch, cx + bw / 2, cy + bw / 2 + 19);
      });
    });

    x.fillStyle = '#D8D2C6'; x.font = '700 46px "Nanum Myeongjo", serif';
    x.fillText(rp.type.name, mid, 760);
    x.fillStyle = '#9A9385'; x.font = '400 30px system-ui, sans-serif';
    wrap(x, rp.type.headline, mid, 820, W - 200, 44);

    const m = rp.chart.meta || {};
    if (m.monthTerm) {
      x.fillStyle = '#8B8477'; x.font = '400 26px system-ui, sans-serif';
      x.fillText(`${m.monthTerm}을 지나 태어남`, mid, H - 190);
    }
    x.fillStyle = '#6E6961'; x.font = '400 24px system-ui, sans-serif';
    x.fillText('사주 한 편', mid, H - 110);

    return cv.toDataURL('image/png');
  }

  function wrap(x, text, cx, y, maxW, lh) {
    const words = String(text || '').split(' ');
    let line = '', n = 0;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (x.measureText(t).width > maxW && line) { x.fillText(line, cx, y + n * lh); line = w; n += 1; }
      else line = t;
    }
    if (line) x.fillText(line, cx, y + n * lh);
  }

  /* ── 시작 ───────────────────────────────────────── */
  $('btn-again').onclick = () => {
    try { localStorage.removeItem(STORE); } catch (e) {}
    location.reload();
  };

  watchScroll();
  Intro.start(cast);
})();
