/* ============================================================
   intro.js — 영상부. 입장부터 생년월일까지.

   왜 영상인가.
   앞은 **끌어들이는 구간**이고 뒤는 **읽는 구간**이다. 쓰는 힘이 다르니 매체도 다르다.
   읽는 구간에 영상을 깔면 글이 안 읽히고, 끌어들이는 구간에 정지 그림을 쓰면
   방에 들어온 느낌이 안 난다.

   규칙 하나. **단추는 영상이 끝나야 뜬다.**
   경쟁 서비스에서 재생 3.4초 시점 선택지 0개, 8.9초 시점 2개인 걸 실측했다.
   기다리게 하는 그 몇 초가 몰입을 만든다. 대신 건너뛰기는 늘 열어둔다.

   규칙 둘. **입력 화면 영상은 루프다.**
   이름·생일을 쓰는 시간은 사람마다 다르다. 1회 재생이면 다 쓰기 전에 화면이 죽는다.

   영상이 아직 없으면 앵커 그림으로 대신한다 — 화면이 비지 않게.
   ============================================================ */
const Intro = (() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const J = typeof Josa !== 'undefined' ? Josa : null;
  const fill = (t, v) => (J ? J.fill(String(t || ''), v) : String(t || ''));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const REDUCED = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // mp4 로 간다. webm 은 iOS 사파리가 오래 안 받아줬다. h264/mp4 가 어디서나 돈다.
  const vsrc = (k) => `assets/video/${k}.mp4`;
  const psrc = (k) => `assets/scene/${k}.webp`;   // png 15.5MB → webp 1.1MB

  /* 각 컷의 영상과, 영상이 없을 때 대신 쓸 그림 */
  const MEDIA = {
    enter:    { v: 'enter',    p: 'greet',  loop: false, hold: 8000 },
    askname:  { v: 'askname',  p: 'point',  loop: true,  hold: 0 },
    askbirth: { v: 'askbirth', p: 'point',  loop: true,  hold: 0, blur: true },
    turn:     { v: 'turn',     p: 'unfold', loop: false, hold: 7000 },
  };

  let state = { name: '', birth: null };
  let onDone = null;

  /* ── 화면 조각 ─────────────────────────────────── */

  function media(key) {
    const m = MEDIA[key];
    return `<video class="iv-media${m.blur ? ' is-blur' : ''}" playsinline muted
              ${m.loop ? 'loop' : ''} preload="auto" poster="${psrc(m.p)}">
              <source src="${vsrc(m.v)}" type="video/mp4">
            </video>
            <img class="iv-still${m.blur ? ' is-blur' : ''}" src="${psrc(m.p)}" alt="" hidden>`;
  }

  function bubbles(lines, v) {
    return `<div class="iv-bubbles">${lines.map((s, i) =>
      `<p class="bub" style="--d:${i * 520}ms">${esc(fill(s, v))}</p>`).join('')}</div>`;
  }

  function choices(list) {
    return `<div class="iv-choices">${list.map((c, i) =>
      `<button type="button" class="iv-choice" data-i="${i}">${esc(c.t)}</button>`).join('')}</div>`;
  }

  /* 영상을 틀고, 끝나면 알린다. 영상이 없으면 그림으로 바꾸고 hold 만큼 기다린다. */
  function play(box, key, whenDone) {
    const v = box.querySelector('.iv-media');
    const still = box.querySelector('.iv-still');
    const m = MEDIA[key];
    let fired = false;
    const done = () => { if (fired) return; fired = true; whenDone && whenDone(); };

    if (!v) { setTimeout(done, m.hold || 0); return; }

    // 파일이 없거나 못 틀면 그림으로 물러난다
    const fallback = () => {
      v.hidden = true;
      if (still) still.hidden = false;
      setTimeout(done, m.hold || 1200);
    };
    v.addEventListener('error', fallback, { once: true });
    v.addEventListener('ended', () => { if (!m.loop) done(); }, { once: true });

    const p = v.play();
    if (p && p.catch) p.catch(fallback);

    // 루프 컷은 끝나기를 기다리지 않는다 — 바로 다음(입력)이 뜬다
    if (m.loop) done();
    // 모션을 줄여달라면 영상을 세우고 그림만 둔다
    if (REDUCED) { try { v.pause(); } catch (e) {} fallback(); }
    // 영상이 영영 안 끝나는 경우를 대비한 안전핀
    if (!m.loop) setTimeout(done, (m.hold || 8000) + 4000);
  }

  const stage = () => $('intro-stage');

  function step(html, key, after) {
    const box = stage();
    box.innerHTML = `${media(key)}<div class="iv-shade"></div><div class="iv-body">${html}</div>
      <button type="button" class="iv-skip" id="iv-skip">건너뛰기 ›</button>`;
    box.scrollTop = 0;
    $('iv-skip').onclick = () => { skipAll(); };
    play(box, key, after);
  }

  /* 단추를 나중에 띄운다. 영상이 끝나야 고를 수 있다. */
  function reveal(html) {
    const b = stage().querySelector('.iv-body');
    const d = document.createElement('div');
    d.className = 'iv-late';
    d.innerHTML = html;
    b.appendChild(d);
    requestAnimationFrame(() => d.classList.add('is-in'));
    return d;
  }

  /* ── 흐름 ──────────────────────────────────────── */

  function cut1() {
    step(bubbles(['…거기 서 있지 말고.'], {}), 'enter', () => {
      const d = reveal(choices([{ t: '들어간다' }, { t: '그냥 본다' }]));
      d.onclick = (e) => {
        const b = e.target.closest('.iv-choice'); if (!b) return;
        cut2(+b.dataset.i === 1);
      };
    });
  }

  function cut2(peeked) {
    const lines = peeked ? ['그러든지.', '어차피 들어올 거면서.'] : ['왔군.', '앉지. 오래 안 걸려.'];
    step(bubbles(lines, {}), 'enter', () => {
      const d = reveal(choices([{ t: '앉는다' }, { t: '(뭐 하는 사람이지?)' }]));
      d.onclick = (e) => {
        const b = e.target.closest('.iv-choice'); if (!b) return;
        cut3(+b.dataset.i === 1);
      };
    });
  }

  function cut3(asked) {
    const lines = asked ? ['곧 알게 돼.', '너, 이름이 뭐냐.'] : ['너, 이름이 뭐냐.'];
    step(bubbles(lines, {}) + `
      <form class="iv-form iv-form-name" id="f-name-form" autocomplete="off">
        <input type="text" id="iv-name" maxlength="12" placeholder="두 글자면 된다" spellcheck="false">
        <button type="submit" class="iv-go">부른다</button>
      </form>
      <button type="button" class="iv-skip-name" id="iv-skip-name">이름 없이 본다</button>`, 'askname');
    setTimeout(() => { const n = $('iv-name'); if (n) n.focus(); }, 400);
    const takeName = (raw) => {
      const name = String(raw || '').replace(/[<>"'*{}]/g, '').trim().replace(/(님|씨)$/, '').slice(0, 12);
      state.name = name;
      if (name) cut4(); else cut5();
    };
    $('f-name-form').onsubmit = (e) => {
      e.preventDefault();
      takeName($('iv-name').value);
    };
    $('iv-skip-name').onclick = () => takeName('');
  }

  /* 이름이 박히는 자리. 만세력에서 일간은 '나'다.
     여덟 글자는 아직 안 섰다. 그래도 사람을 먼저 부른다.
     웹툰이 회차 제목 대신 주인공 이름을 한 칸 가득 쓰는 그 컷이다. */
  function cut4() {
    const nm = state.name;
    step(`<div class="iv-shout-wrap" id="iv-shout-wrap" aria-live="assertive">
            <p class="iv-shout" id="iv-shout"></p>
          </div>`
      + bubbles([], {}), 'askname');

    const el = $('iv-shout');
    const fire = () => {
      el.textContent = nm + '!';
      el.classList.add('is-in');
      const wrap = $('iv-shout-wrap');
      if (wrap) wrap.classList.add('is-flash');
    };
    if (REDUCED) fire();
    else setTimeout(fire, 280);

    setTimeout(() => {
      const b = stage().querySelector('.iv-bubbles');
      if (!b) return;
      b.innerHTML = [
        fill('{이름}.', { 이름: nm }),
        '정신 차려. 지금부터 네 얘기다.',
      ].map((s, i) =>
        `<p class="bub bub-sharp" style="--d:${i * 380}ms">${esc(s)}</p>`).join('');
      setTimeout(cut5, REDUCED ? 900 : 2600);
    }, REDUCED ? 400 : 1400);
  }

  function cut5() {
    const y = new Date().getFullYear();
    const nm = state.name;
    step(bubbles([
      fill('{이름}.', { 이름: nm }),
      '이 세상에 들어온 때. 달력 숫자 말고, 절기가 갈리는 그 순간이다.',
    ], {}) + `
      <form class="iv-form iv-form-birth" id="f-birth-form" autocomplete="off">
        <div class="iv-seg" role="radiogroup" aria-label="달력">
          <label><input type="radio" name="iv-cal" value="solar" checked><span>양력</span></label>
          <label><input type="radio" name="iv-cal" value="lunar"><span>음력</span></label>
        </div>
        <div class="iv-row iv-row-date">
          <label class="iv-cell"><span>년</span><input type="number" id="iv-y" inputmode="numeric" min="1900" max="${y}" placeholder="1990" required></label>
          <label class="iv-cell"><span>월</span><input type="number" id="iv-m" inputmode="numeric" min="1" max="12" placeholder="12" required></label>
          <label class="iv-cell"><span>일</span><input type="number" id="iv-d" inputmode="numeric" min="1" max="31" placeholder="5" required></label>
        </div>
        <div class="iv-row iv-row-t">
          <label class="iv-cell"><span>시</span><input type="number" id="iv-h" inputmode="numeric" min="0" max="23" placeholder="06"></label>
          <label class="iv-cell"><span>분</span><input type="number" id="iv-i" inputmode="numeric" min="0" max="59" placeholder="30"></label>
          <label class="iv-chk"><input type="checkbox" id="iv-unk"><span>시각 모름</span></label>
        </div>
        <div class="iv-seg" role="radiogroup" aria-label="성별">
          <label><input type="radio" name="iv-sex" value="F" checked><span>여</span></label>
          <label><input type="radio" name="iv-sex" value="M"><span>남</span></label>
        </div>
        <p class="iv-err" id="iv-err" role="alert"></p>
        <button type="submit" class="iv-go iv-go-wide" id="iv-cast">${submitLabel(false)}</button>
      </form>`, 'askbirth');

    $('iv-unk').onchange = (e) => {
      const off = e.target.checked;
      ['iv-h', 'iv-i'].forEach((k) => { $(k).disabled = off; if (off) $(k).value = ''; });
      const btn = $('iv-cast');
      if (btn) btn.textContent = submitLabel(off);
    };

    $('f-birth-form').onsubmit = (e) => {
      e.preventDefault();
      const n = (k) => { const x = parseInt($(k).value, 10); return Number.isFinite(x) ? x : null; };
      const unk = $('iv-unk').checked;
      const b = {
        calendar: document.querySelector('input[name="iv-cal"]:checked').value,
        year: n('iv-y'), month: n('iv-m'), day: n('iv-d'),
        hour: unk ? null : n('iv-h'), minute: unk ? null : n('iv-i'),
        unknownTime: unk,
        gender: document.querySelector('input[name="iv-sex"]:checked').value,
      };
      if (!b.year || !b.month || !b.day) { $('iv-err').textContent = '태어난 해·달·날은 있어야 해.'; return; }
      state.birth = b;
      cut6();
    };
  }

  function submitLabel(unknownTime) {
    return unknownTime ? '여섯 글자를 세워' : '여덟 글자를 세워';
  }

  function openLine(unknownTime) {
    return unknownTime
      ? '만세력이 열렸다. 연·월·일, 세 기둥이다. 시주는 비운다.'
      : '만세력이 열렸다. 연·월·일·시, 네 기둥이다.';
  }

  function cut6() {
    const b = state.birth;
    const nm = state.name;
    const when = `${b.year}년 ${b.month}월 ${b.day}일`;
    const unk = !!(b && b.unknownTime);
    step(`<div class="iv-name-card"><p class="iv-big iv-big-date">${esc(when)}</p></div>`
      + bubbles([
        fill('{이름}.', { 이름: nm }),
        openLine(unk),
      ], {}), 'turn', () => {
      onDone && onDone(state);
    });
  }

  function skipAll() {
    // 건너뛰어도 이름과 생일은 있어야 한다. 없으면 입력 컷으로 보낸다.
    if (!state.name) return cut3(false);
    if (!state.birth) return cut5();
    onDone && onDone(state);
  }

  function start(done) {
    onDone = done;
    state = { name: '', birth: null };
    cut1();
  }

  return { start, submitLabel, openLine, get state() { return state; } };
})();

if (typeof module !== 'undefined') module.exports = Intro;
