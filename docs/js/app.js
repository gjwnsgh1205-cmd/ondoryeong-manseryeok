/* ============================================================
 * 앱 흐름 (app.js)
 *
 * 고민 → 생시 → 상담. 세 화면을 오가는 것이 전부다.
 * 계산은 manseryeok.js, 주제는 topics.js, 대화 규칙은 consult.js가 쥔다.
 * 여기서는 화면 전환과 그리기만 한다.
 * ============================================================ */

(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const E = Manse.ELEMENTS;
  const EL_COLORS = ['var(--el-wood)', 'var(--el-fire)', 'var(--el-earth)', 'var(--el-metal)', 'var(--el-water)'];
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let REDUCED = !!(motionQuery && motionQuery.matches);
  const scrollBehavior = () => (REDUCED ? 'auto' : 'smooth');

  // 화면 상태
  let selectedTopic = null;
  let chart = null, ageMonths = 0, session = null;
  let busy = false, revealTimer = null;

  // ---------- 캐릭터 영상 ----------
  const started = new WeakSet(), completed = new WeakSet(), inView = new WeakSet();
  const ONCE_RATIO = 0.35;

  function activeSection() {
    if (!$('#loading-overlay').classList.contains('hidden')) return $('#loading-overlay');
    return $$('.step').find(s => !s.classList.contains('hidden')) || document.body;
  }
  const playVideo = (v) => { if (!REDUCED) v.play().catch(() => {}); };
  function playIn(root) {
    if (!root || REDUCED) return;
    root.querySelectorAll('video.dr-media').forEach(v => {
      if (v.dataset.loop === 'false') {
        if (!inView.has(v) || completed.has(v)) return;
        if (!started.has(v)) { started.add(v); v.currentTime = 0; }
      }
      playVideo(v);
    });
  }
  function pauseIn(root) {
    if (root) root.querySelectorAll('video.dr-media').forEach(v => v.pause());
  }
  const onceObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const v = e.target;
          if (!e.isIntersecting || e.intersectionRatio < ONCE_RATIO) { inView.delete(v); v.pause(); continue; }
          inView.add(v);
          if (REDUCED || completed.has(v)) continue;
          if (!started.has(v)) { started.add(v); v.currentTime = 0; }
          playVideo(v);
        }
      }, { threshold: [0, ONCE_RATIO] })
    : null;
  let observedOnce = [];
  function registerOnce(root) {
    if (!onceObserver) return;
    observedOnce.forEach(v => { onceObserver.unobserve(v); inView.delete(v); started.delete(v); completed.delete(v); });
    observedOnce = root ? Array.from(root.querySelectorAll('video.dr-media[data-loop="false"]')) : [];
    observedOnce.forEach(v => {
      v.addEventListener('ended', () => { completed.add(v); onceObserver.unobserve(v); }, { once: true });
      onceObserver.observe(v);
    });
  }
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener('change', (e) => {
      REDUCED = e.matches;
      if (REDUCED) pauseIn(document); else playIn(activeSection());
    });
  }

  // ---------- 화면 전환 ----------
  function show(id) {
    $$('.step').forEach(s => {
      const on = s.id === id;
      s.classList.toggle('hidden', !on);
      if (!on) pauseIn(s);
    });
    const cur = $('#' + id);
    playIn(cur);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    return cur;
  }

  function setLoading(on) {
    const ov = $('#loading-overlay');
    ov.classList.toggle('hidden', !on);
    ov.setAttribute('aria-hidden', on ? 'false' : 'true');
    $$('.step').forEach(s => on ? s.setAttribute('inert', '') : s.removeAttribute('inert'));
    if (on) playIn(ov); else pauseIn(ov);
  }

  // ---------- 1단계 · 고민 ----------
  function renderTopics() {
    const grid = $('#topic-grid');
    grid.innerHTML = Topics.groups().map(g => `
      <div class="topic-group">
        <h3 class="topic-group-title">${esc(g)}</h3>
        <div class="topic-row">
          ${Topics.LIST.filter(t => t.group === g).map(t => `
            <button type="button" class="topic-card" data-topic="${t.id}">
              <span class="topic-label">${esc(t.label)}</span>
              <span class="topic-banner">${esc(t.banner)}</span>
            </button>`).join('')}
        </div>
      </div>`).join('');

    grid.querySelectorAll('.topic-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const same = selectedTopic === btn.dataset.topic;
        grid.querySelectorAll('.topic-card').forEach(b => b.classList.remove('on'));
        selectedTopic = same ? null : btn.dataset.topic;
        if (!same) btn.classList.add('on');
        syncConcern();
      });
    });
  }

  function syncConcern() {
    const hasStory = $('#f-situation').value.trim().length > 0;
    $('#btn-to-birth').disabled = !(selectedTopic || hasStory);
  }

  $('#f-situation').addEventListener('input', syncConcern);

  $('#btn-to-birth').addEventListener('click', () => {
    const t = selectedTopic ? Topics.byId(selectedTopic) : null;
    const story = $('#f-situation').value.trim();
    $('#chosen-bar').innerHTML = `
      ${t ? `<span class="chip">${esc(t.label)}</span>` : ''}
      ${story ? `<span class="chosen-story">“${esc(story.length > 70 ? story.slice(0, 70) + '…' : story)}”</span>` : ''}`;

    const box = $('#partner-box');
    if (t && t.needsPartner) {
      box.classList.remove('hidden');
      $('#partner-optional').textContent = t.partnerOptional ? '(몰라도 괜찮네)' : '(필요하다네)';
    } else {
      box.classList.add('hidden');
    }
    show('step-birth');
    $('#f-year').focus({ preventScroll: true });
  });

  $('#btn-back-concern').addEventListener('click', () => show('step-concern'));

  // ---------- 2단계 · 생시 ----------
  const unknownCk = $('#f-unknown-time');
  unknownCk.addEventListener('change', () => {
    const dis = unknownCk.checked;
    $('#f-hour').disabled = dis; $('#f-minute').disabled = dis;
    if (dis) { $('#f-hour').value = ''; $('#f-minute').value = ''; }
  });

  function koreanAgeMonths(y, m, d) {
    const now = new Date();
    let mo = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    if (now.getDate() < d) mo -= 1;
    return Math.max(0, mo);
  }

  function readBirth(prefix) {
    const v = (id) => $(`#${prefix}${id}`).value;
    return { y: +v('year'), m: +v('month'), d: +v('day') };
  }

  $('#birth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;

    const year = +$('#f-year').value, month = +$('#f-month').value, day = +$('#f-day').value;
    const unknownTime = unknownCk.checked;
    const hour = unknownTime ? 12 : +($('#f-hour').value || 0);
    const minute = unknownTime ? 0 : +($('#f-minute').value || 0);
    const gender = document.querySelector('input[name=gender]:checked').value;
    const useTrueSolar = $('#f-true-solar').checked;

    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
      return alert('존재하지 않는 날짜예요. 다시 확인해 주세요.');
    }
    const birthDT = unknownTime ? dt : new Date(year, month - 1, day, hour, minute);
    if (birthDT > new Date()) return alert('미래의 날짜·시각은 풀이할 수 없어요.');
    if (!unknownTime && ($('#f-hour').value === '' || $('#f-minute').value === '')) {
      return alert('태어난 시각을 입력하거나 "시각을 몰라요"를 선택해 주세요.');
    }

    let partnerChart = null;
    const t = selectedTopic ? Topics.byId(selectedTopic) : null;
    if (t && t.needsPartner) {
      const p = readBirth('p-');
      if (p.y && p.m && p.d) {
        try {
          partnerChart = Manse.compute({ year: p.y, month: p.m, day: p.d, gender: gender === 'M' ? 'F' : 'M', unknownTime: true, useTrueSolar });
        } catch (err) { return alert('상대 생년월일: ' + (err.message || '확인해 주세요.')); }
      } else if (!t.partnerOptional) {
        return alert('이 주제는 상대의 생년월일이 필요하다네.');
      }
    }

    try {
      chart = Manse.compute({ year, month, day, hour, minute, gender, unknownTime, useTrueSolar });
    } catch (err) { return alert(err.message || '계산 중 문제가 생겼어요.'); }

    ageMonths = koreanAgeMonths(year, month, day);
    session = Consult.start({
      topic: selectedTopic, chart, ageMonths,
      situation: $('#f-situation').value.trim(), partnerChart,
    });

    busy = true;
    setLoading(true);
    revealTimer = setTimeout(() => {
      revealTimer = null;
      openConsult();
      setLoading(false);
      busy = false;
    }, REDUCED ? 0 : 1150);
  });

  // ---------- 3단계 · 상담 ----------
  function openConsult() {
    renderChartFold();
    $('#chat').innerHTML = '';
    registerOnce(null);

    say('doryeong', Consult.opening(session));
    const pv = Consult.freePreview(session);
    if (pv) say('doryeong', pv, { soft: true });

    syncTurns();
    show('step-consult');
    $('#consult-heading').focus({ preventScroll: true });
    $('#f-ask').focus({ preventScroll: true });
  }

  function say(role, text, opt = {}) {
    const chat = $('#chat');
    const el = document.createElement('div');
    el.className = `msg msg-${role}${opt.soft ? ' msg-soft' : ''}${opt.crisis ? ' msg-crisis' : ''}`;
    el.innerHTML = role === 'doryeong'
      ? `<img class="msg-avatar" src="assets/web/doryeong-idle.png" alt="" aria-hidden="true">
         <div class="msg-body"><span class="msg-who">온도령</span>${esc(text)}</div>`
      : `<div class="msg-body">${esc(text)}</div>`;
    chat.appendChild(el);
    el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    return el;
  }

  function thinking() {
    const el = say('doryeong', '');
    el.querySelector('.msg-body').innerHTML =
      `<span class="msg-who">온도령</span><span class="typing"><i></i><i></i><i></i></span>`;
    return el;
  }

  function syncTurns() {
    const left = Consult.remaining(session);
    const note = session.endedByCrisis ? ''
      : left > 0 ? `남은 질문 ${left}번`
      : session.paid ? '상담권을 다 쓰셨네' : '여기까지가 무료로 볼 수 있는 만큼일세';
    $('#turns-left').textContent = note;
    $('#pass-box').classList.toggle('hidden', !(left <= 0 && !session.endedByCrisis));
    const disabled = session.endedByCrisis || left <= 0;
    $('#f-ask').disabled = disabled;
    $('#btn-ask').disabled = disabled;
  }

  $('#ask-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = $('#f-ask');
    const text = box.value.trim();
    if (!text || busy) return;

    say('user', text);
    box.value = ''; box.style.height = '';
    busy = true;
    $('#btn-ask').disabled = true;
    const ph = thinking();

    let res;
    try {
      res = await Consult.ask(session, text);
    } catch (err) {
      res = { text: '풀이 중에 문제가 생겼네. 잠시 뒤에 다시 물어봐 주시게.' };
    }
    ph.remove();
    say('doryeong', res.text, { crisis: res.crisis });
    busy = false;
    syncTurns();
    if (!$('#f-ask').disabled) $('#f-ask').focus({ preventScroll: true });
  });

  // 엔터로 보내기, Shift+엔터는 줄바꿈
  $('#f-ask').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ask-form').requestSubmit(); }
  });
  $('#f-ask').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  });

  $('#btn-pass').addEventListener('click', () => {
    // 결제 연동 전까지는 그냥 열어준다. 서버가 붙으면 결제 검증 후 grantPass를 부른다.
    Consult.grantPass(session);
    say('doryeong', '상담권을 받았네. 이제 다섯 번 더 물을 수 있으니 편히 물어보시게.', { soft: true });
    syncTurns();
    $('#f-ask').focus({ preventScroll: true });
  });

  $('#btn-again').addEventListener('click', () => {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
    busy = false;
    setLoading(false);
    session = null; chart = null;
    show('step-concern');
  });

  // ---------- 명식 요약 ----------
  function renderChartFold() {
    const p = chart.pillars, inp = chart.input;
    const g = (x) => x ? `${x.stemInfo.kor}${x.branchInfo.kor}` : '—';
    $('#chart-brief').textContent =
      `${g(p.year)} ${g(p.month)} ${g(p.day)} ${g(p.hour)} · 일간 ${Manse.STEMS[chart.dayStem].kor}`;

    const mk = (pl) => {
      if (!pl) return `<div class="pillar"><div class="pillar-label">시주</div><div class="pillar-empty">시각 모름</div></div>`;
      const isDay = pl.label === '일주';
      return `<div class="pillar">
        <div class="pillar-label"><b>${pl.label}</b></div>
        <div class="glyph-stack">
          <div class="glyph el-${pl.stemInfo.el}${isDay ? ' day-stem' : ''}">
            <span class="han">${pl.stemInfo.han}</span>
            <span class="kor">${pl.stemInfo.kor} · ${E[pl.stemInfo.el].kor}</span>
            <span class="sip">${esc(isDay ? '일간 · 나' : pl.stemSipseong)}</span>
          </div>
          <div class="glyph el-${pl.branchInfo.el}">
            <span class="han">${pl.branchInfo.han}</span>
            <span class="kor">${pl.branchInfo.kor} · ${pl.branchInfo.animal}</span>
            <span class="sip">${esc(pl.branchSipseong)}</span>
          </div>
        </div>
        <div class="hidden-stems">지장간 ${pl.hidden.map(h => h.info.kor).join('·')}</div>
      </div>`;
    };
    $('#pillar-board').innerHTML = mk(p.year) + mk(p.month) + mk(p.day) + mk(p.hour);

    const m = chart.meta;
    let note = `절기 기준 ${m.sajuYear}년주 · ${m.monthTerm} 이후 월주`;
    note += inp.unknownTime ? ' · 시각 미상, 정오 가정'
      : ` · 보정 시각 ${String(m.adjusted.hh).padStart(2, '0')}:${String(m.adjusted.mm).padStart(2, '0')}`;
    const warns = [];
    if (m.boundaryWarning) warns.push(`절기(${m.nearestTermName}) 경계 ${m.nearestTermMin}분 이내 출생 — 시각을 한 번 더 확인해 보시게`);
    if (m.timeStatus === 'fold') warns.push('서머타임으로 두 번 존재했던 시각 — 표준시로 해석했네');
    if (!m.precise) warns.push('정밀 계산 모듈을 못 불러와 근사(±15분)로 계산했네');
    $('#board-note').innerHTML = esc(note) + warns.map(w => `<br><span class="note-warn">⚠ ${esc(w)}</span>`).join('');

    const max = Math.max(...chart.elCount, 1);
    $('#element-chart').innerHTML = chart.elCount.map((v, i) => `
      <div class="el-row">
        <div class="el-name">${E[i].kor}<span class="han">${E[i].han}</span></div>
        <div class="el-track"><div class="el-fill" data-w="${(v / max * 100).toFixed(0)}" style="background:${EL_COLORS[i]}"></div></div>
        <div class="el-val">${v.toFixed(1)}</div>
      </div>`).join('');
    requestAnimationFrame(() => $$('.el-fill').forEach(el => { el.style.width = el.dataset.w + '%'; }));

    const cur = Counsel.currentDaeun(chart.daeun, ageMonths);
    const fmt = (mo) => `${Math.floor(mo / 12)}세${mo % 12 ? ' ' + (mo % 12) + '개월' : ''}`;
    $('#daeun-timeline').innerHTML = chart.daeun.map(d => `
      <div class="daeun-item ${cur.daeun && d.startMonths === cur.daeun.startMonths ? 'current' : ''}">
        <div class="age">${fmt(d.startMonths)}~</div>
        <div class="gz">${d.stemInfo.han}<br>${d.branchInfo.han}</div>
        <div class="sip">${esc(d.stemSip)}</div>
      </div>`).join('');
  }

  // ---------- 초기 렌더 ----------
  renderTopics();
  $('#dr-hero').innerHTML = Doryeong.media({ kind: 'idle', loop: true, label: '온도령 캐릭터' });
  $('#dr-loading').innerHTML = Doryeong.media({ kind: 'reading', loop: true });
  $('#dr-greet').innerHTML = `<span class="dr-name">온도령</span>` + esc(Doryeong.GREET);
  playIn($('#step-concern'));
  document.addEventListener('doryeong:videos-ready', () => playIn(activeSection()));
})();
