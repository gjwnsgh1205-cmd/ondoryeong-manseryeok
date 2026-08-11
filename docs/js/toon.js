/* ============================================================
   toon.js — 웹툰 컷을 그린다.

   컷은 네 종류뿐이다. 더 만들지 않는다 —
   종류가 늘면 리듬이 사라지고 그냥 긴 페이지가 된다.

     scene  앵커 그림 풀블리드 + 말풍선        어둠
     prose  한지 흰 바탕에 본문                밝음   ← 4만 자가 여기
     chart  여덟 글자 표 / 오행 / 대운 곡선    밝음
     beat   검은 화면에 대사 한 줄             어둠
     card   주인공 카드 (권두·발문 두 번)      어둠

   **어둠과 빛이 번갈아 지나가는 것**이 이 화면의 전부다.
   스크롤하면 어두운 컷과 밝은 글이 교대한다. 그래서 웹툰처럼 읽힌다.
   경쟁 서비스는 끝까지 어두워서 글이 안 읽힌다. 거기가 우리가 이기는 자리다.

   이름은 **말풍선에서만 부른다.** 본문은 "당신은"도 "{이름}님은"도 쓰지 않는다.
   화자가 나를 부르는 것과 글이 나를 지칭하는 것은 감각이 전혀 다르다 —
   앞은 대화고 뒤는 설문지다.
   ============================================================ */
const Toon = (() => {
  'use strict';

  const J = typeof Josa !== 'undefined' ? Josa : null;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* 값을 끼우고 조사를 고른다.
     {이름}이 를 그냥 이으면 "허준호이" 가 된다. 받침을 봐야 한다. */
  const fill = (t, v) => (J ? J.fill(String(t || ''), v) : String(t || ''));

  /* **굵게** 를 <b> 로. 본문에서 명리 용어를 짚을 때 쓴다. */
  const bold = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  const anchorSrc = (key) => `assets/scene/${key}.webp`;   // png 15.5MB → webp 1.1MB

  /* ── 컷 ─────────────────────────────────────────────── */

  function scene(c, v) {
    const says = (Array.isArray(c.say) ? c.say : [c.say]).filter(Boolean);
    return `<section class="cut cut-scene reveal" data-anchor="${esc(c.anchor)}">
      <img class="cut-bg" src="${anchorSrc(c.anchor)}" alt="" loading="lazy" decoding="async">
      <div class="cut-shade"></div>
      <div class="bubbles">${says.map((s, i) => `
        <p class="bub" style="--d:${i * 520}ms">${bold(fill(s, v))}</p>`).join('')}
      </div>
    </section>`;
  }

  function beat(c, v) {
    return `<section class="cut cut-beat reveal">
      <p class="beat-line">${bold(fill(c.say, v))}</p>
    </section>`;
  }

  function prose(c, v) {
    const paras = (c.paras || []).filter(Boolean);
    return `<section class="cut cut-prose reveal">
      ${c.title ? `<h3 class="pr-t">${bold(fill(c.title, v))}</h3>` : ''}
      ${c.lead ? `<p class="pr-lead">${bold(fill(c.lead, v))}</p>` : ''}
      ${paras.map((p) => `<p class="pr-p">${bold(fill(p, v))}</p>`).join('')}
    </section>`;
  }

  /* 여덟 글자. 천간 위 지지 아래 — 명경 로딩에서 새겨진 것과 같은 배열이다. */
  function chart(c, v) {
    const cols = c.pillars || [];
    return `<section class="cut cut-chart reveal">
      ${c.title ? `<h3 class="pr-t">${bold(fill(c.title, v))}</h3>` : ''}
      <div class="ch-board">${cols.map((p) => `
        <div class="ch-col">
          <b class="ch-top">${esc(p.top)}</b>
          <b class="ch-bot">${esc(p.bot)}</b>
          <i class="ch-tag">${esc(p.tag)}</i>
        </div>`).join('')}</div>
      ${c.foot ? `<p class="ch-foot">${bold(fill(c.foot, v))}</p>` : ''}
    </section>`;
  }

  /* 주인공 카드. 권두와 발문에 같은 모양으로 두 번 —
     수미상관이 "한 편을 다 읽었다" 는 감각을 만든다. */
  function card(c, v) {
    const name = (v && v.이름) || '';
    return `<section class="cut cut-card reveal">
      <div class="card">
        ${name ? `<p class="cd-name">${esc(name)}</p>` : ''}
        <p class="cd-birth">${esc(c.birth || '')}</p>
        ${c.sub ? `<p class="cd-sub">${esc(c.sub)}</p>` : ''}
        <div class="cd-board">${(c.pillars || []).map((p) => `
          <span class="cd-col"><b>${esc(p.top)}</b><b>${esc(p.bot)}</b></span>`).join('')}</div>
        ${c.term ? `<p class="cd-term">${esc(c.term)}</p>` : ''}
        ${c.tail ? `<p class="cd-tail">${bold(fill(c.tail, v))}</p>` : ''}
      </div>
      ${c.saveable ? '<button type="button" class="cd-save" id="btn-card-save">이 장면 간직하기</button>' : ''}
    </section>`;
  }

  const DRAW = { scene, beat, prose, chart, card };

  /** 컷 배열을 통째로 그린다. */
  function render(box, cuts, values) {
    const v = values || {};
    box.innerHTML = cuts.map((c) => (DRAW[c.kind] ? DRAW[c.kind](c, v) : '')).join('');
    watch(box);
    return box;
  }

  /* 화면에 들어올 때 컷이 떠오른다.
     한 번 뜬 컷은 다시 숨기지 않는다 — 위로 스크롤할 때마다 깜빡이면 성가시다. */
  let io = null;
  function watch(box) {
    if (io) io.disconnect();
    const rows = box.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      rows.forEach((r) => r.classList.add('is-in'));
      return;
    }
    io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    rows.forEach((r) => io.observe(r));
  }

  return { render, fill, bold, anchorSrc };
})();

if (typeof module !== 'undefined') module.exports = Toon;
