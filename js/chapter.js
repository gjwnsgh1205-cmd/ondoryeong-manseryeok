/* ============================================================
   chapter.js — 한 편의 긴 글을 화면에 그린다.

   왜 만들었나.
   원래 이 앱은 풀이를 칸 열 개로 쪼개 보여줬다. 제목·왜·일돈·사람·몸·시간대·
   해볼것·미룰것·걸림·사람. 정보는 다 있는데 읽는 맛이 없었고, 사용자가 그대로 말했다.
   "너무 파편화되어 있고 짧게 짧게라 의미가 없어 보인다."

   그래서 칸을 없애고 장(章)으로 바꿨다. 한 장은 이렇게 생겼다.
       { title, lead, paras[], cutAt }
   제목이 있고, 문단이 흐르고, cutAt 번째 문단까지만 무료로 열린다.

   여기서 하는 일은 셋이다.
     ① 슬롯을 채운다      — {물상} {이름} {대운간지} … 조사는 josa.js 가 고른다
     ② **굵게** 를 푼다   — 간지·십성처럼 눈이 걸려야 하는 낱말
     ③ cutAt 에서 자른다  — 그 뒤는 글자 폭 막대로만 그린다

   자르는 자리를 문단2 끝으로 잡은 이유.
   문단1 끝은 너무 이르다. 아직 받은 게 없어서 결제가 아니라 이탈이 된다.
   문단2 중간은 글을 억지로 훼손한다. 두 문단이면 "이 사람이 나를 아네" 까지는
   가고, 그다음이 궁금해진다. 그래서 기본값이 2다. (대운은 1 — 십 년 이야기는
   더 궁금해야 한다.)

   가린 자리에 진짜 글자를 넣지 않는 이유.
   blur 는 개발자도구로 걷어내면 그대로 읽힌다. 그래서 글자 수만큼의 막대를 그린다.
   다만 이건 DOM 이야기일 뿐이다 — 원고 파일 자체는 아직 브라우저로 통째로 내려간다.
   결제를 붙일 때 유료분을 서버 쪽으로 옮겨야 한다.
   ============================================================ */
const Chapter = (() => {
  'use strict';

  const J = typeof Josa !== 'undefined' ? Josa : (typeof require !== 'undefined' ? require('./josa.js') : null);

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* **굵게** 를 <b> 로. 이스케이프를 먼저 하고 나서 태그를 넣는다 —
     순서를 바꾸면 원고에 든 < 가 태그로 살아난다. */
  function bold(text) {
    return esc(text).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }

  /* 슬롯 채우기.
     이름은 안 받을 수도 있다. 그때 "{이름}님은 지금 …" 을 그냥 두면
     "님은 지금" 이 남는다. 그래서 이름이 비면 그 덩어리째 지운다.
     글 쓰는 쪽에는 "{이름}님 은 문장 첫머리에만" 이라고 못 박아 뒀다. */
  function fill(text, values) {
    let s = String(text || '');
    if (!values || !values.이름) s = s.replace(/\{이름\}님(은|이|께서)?\s*/g, '');
    return J ? J.fill(s, values || {}) : s;
  }

  /* 가린 문단 — 글자 수만큼 줄을 그린다.
     한 줄에 26자로 끊는 건 화면 폭에서 대충 그쯤 들어가기 때문이다.
     마지막 줄은 짧게 둬야 문단처럼 보인다. */
  function veilPara(text) {
    const n = [...String(text || '')].length;
    const rows = [];
    let left = Math.max(12, Math.min(240, n));
    while (left > 0) { rows.push(Math.min(left, 26)); left -= 26; }
    if (rows.length > 1) rows[rows.length - 1] = Math.max(8, Math.round(rows[rows.length - 1] * 0.6));
    return '<p class="cp-veil" role="img" aria-label="구독하면 열리는 자리">'
      + rows.map((w) => `<i style="width:${w}ch"></i>`).join('') + '</p>';
  }

  /* 한 장을 통째로 그린다.

     opts.open   구독 중이면 true — 전부 보여준다
     opts.values 슬롯에 넣을 값
     opts.act    { doThis, avoid } — 글 아래에 따로 붙이는 행동 한 줄.
                 코덱스와 합의한 자리다. 해석은 읽는 영역이고 행동은 실행하는
                 영역이라, 문단에 녹이면 좋은 문장이어도 지나친다.
     opts.cta    가린 자리 밑에 붙일 단추 HTML */
  function render(ch, opts = {}) {
    if (!ch) return '';
    const v = opts.values || {};
    const paras = Array.isArray(ch.paras) ? ch.paras : [];
    const cut = opts.open ? paras.length : Math.max(1, Math.min(paras.length, ch.cutAt || 2));

    const out = ['<article class="cp">'];
    if (ch.title) out.push(`<h4 class="cp-t">${bold(fill(ch.title, v))}</h4>`);
    if (ch.lead) out.push(`<p class="cp-lead">${bold(fill(ch.lead, v))}</p>`);

    out.push('<div class="cp-body">');
    paras.forEach((p, i) => {
      const t = fill(p, v);
      out.push(i < cut ? `<p>${bold(t)}</p>` : veilPara(t));
    });
    out.push('</div>');

    if (cut < paras.length) {
      out.push(`<p class="cp-more">여기서부터 ${paras.length - cut}문단이 더 있어요.</p>`);
      if (opts.cta) out.push(opts.cta);
    }

    /* 행동은 글이 끝난 뒤에 따로 선다. 읽는 것과 하는 것을 눈으로 갈라둔다. */
    const a = opts.act;
    if (a && (a.doThis || a.avoid)) {
      out.push('<div class="cp-act">');
      if (a.doThis) out.push(`<div class="cp-do"><i>오늘 해볼 것</i><span>${esc(fill(a.doThis, v))}</span></div>`);
      if (a.avoid) {
        out.push(`<div class="cp-do is-hold"><i>오늘 미뤄둘 것</i><span>${
          opts.open ? esc(fill(a.avoid, v)) : veilPara(a.avoid).replace(/^<p class="cp-veil"/, '<span class="cp-veil"').replace(/<\/p>$/, '</span>')
        }</span></div>`);
      }
      out.push('</div>');
    }

    out.push('</article>');
    return out.join('');
  }

  return { render, bold, fill, veilPara };
})();

if (typeof module !== 'undefined') module.exports = Chapter;
