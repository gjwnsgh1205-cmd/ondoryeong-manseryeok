/* ============================================================
   ads.js — 광고 자리.

   무엇을 정했나.
   값은 한 번만 받는다(4,900원). 그러면 둘째 달부터 들어오는 돈이 없다.
   대신 오늘의 운수를 공짜로 열어 날마다 오게 만들었다. 그 발걸음에서 나오는 몫이 광고다.
   그래서 **광고는 결제 여부와 무관하게 늘 붙는다.** 결제한 사람에게도 붙는다.
   광고 제거를 팔지 않기로 했으니 "결제하면 깨끗해진다"는 약속을 만들면 안 된다.

   지금 광고망은 안 붙어 있다.
   계정이 없는 상태에서 남의 배너처럼 생긴 걸 그려 넣는 건 거짓말이다.
   그래서 기본값은 **우리 것을 안내하는 자리(house)** 다. 진짜 내용이고, 진짜 눌린다.
   계정이 생기면 아래 CONF 한 덩어리만 채우면 그 자리에 광고망 태그가 들어간다.

   자리 규칙 — 코덱스와 맞춘 선.
     · 글 문단 사이에 끼우지 않는다. 읽는 흐름을 끊으면 글이 안 팔린다.
     · 덩어리(주간 막대·명식표)가 끝난 **다음** 자리에만 둔다.
     · 한 탭에 하나. 오늘 탭만 둘(중간·바닥) — 매일 오는 화면이라 여기가 본진이다.
     · 화면에 고정하지 않는다. 아래 고정 자리는 값 바(paybar)가 이미 쓴다.
     · "광고" 라고 적는다. 안 적으면 콘텐츠인 척이 된다.
   ============================================================ */
const Ads = (() => {
  'use strict';

  /* 광고망을 붙일 때 여기만 채운다.
     kind: 'none' | 'adfit' | 'adsense'
     adfit  — 카카오 애드핏. unit 은 DAN-xxxxxxxx 꼴.
     adsense— 구글 애드센스. client 는 ca-pub-xxxxxxxx, slot 은 숫자.
     쓰는 자리마다 크기가 달라 units 로 나눠 둔다. */
  const CONF = {
    kind: 'none',
    adfit: { units: {} },                 // { 'today-mid': 'DAN-…', … }
    adsense: { client: '', slots: {} },   // { 'today-mid': '1234567890', … }
  };

  /* 어느 자리에 어떤 집 광고를 낼지. 자리마다 말이 달라야 한 화면에 둘이 떠도 안 겹친다. */
  const HOUSE = {
    'today-mid': {
      lead: '오늘 말고 나라는 사람 전체가 궁금하다면',
      body: '타고난 성격·사주팔자·인생 흐름은 명식 하나로 129편을 씁니다.',
      cta: '가려진 데까지 열기',
    },
    'today-foot': {
      lead: '내일 또 오세요',
      body: '오늘의 운수는 날마다 새로 씁니다. 값은 받지 않아요.',
      cta: '어제 것과 뭐가 달랐나',
      quiet: true,   // 아래쪽 자리는 단추를 안 건다. 나가는 사람을 붙잡지 않는다.
    },
    'nature-foot': {
      lead: '성격은 여기까지가 바탕이에요',
      body: '지금 지나는 십 년이 이 성격을 어느 쪽으로 밀고 있는지는 인생 흐름에 있어요.',
      cta: '인생 흐름 보기',
      to: 'flow',
    },
    'saju-foot': {
      lead: '여덟 글자를 다 봤다면',
      body: '이 글자들이 오늘 하루에 어떻게 떨어지는지는 날마다 바뀝니다.',
      cta: '오늘의 운수 보기',
      to: 'today',
    },
    'flow-foot': {
      lead: '십 년은 알았고 하루는요',
      body: '큰 흐름 안에서 오늘 하루가 어느 쪽인지 매일 새로 잽니다.',
      cta: '오늘의 운수 보기',
      to: 'today',
    },
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* 자리를 만든다. 아직 비어 있다 — 채우는 건 mount 다.
     innerHTML 로 넣는 자리라 문자열을 돌려준다. */
  function slot(id) {
    return `<div class="adslot" data-ad="${esc(id)}"><span class="adslot-tag">광고</span></div>`;
  }

  /* 집 광고 한 장. */
  function house(id) {
    const h = HOUSE[id];
    if (!h) return '';
    const btn = h.quiet ? ''
      : `<button type="button" class="ad-cta"${h.to ? ` data-goto="${esc(h.to)}"` : ''}>${esc(h.cta)}</button>`;
    return `<div class="ad-house">
      <i class="ad-lead">${esc(h.lead)}</i>
      <p class="ad-body">${esc(h.body)}</p>
      ${btn}
    </div>`;
  }

  /* 광고망 태그. 계정이 없으면 null 을 돌려 집 광고로 넘어간다. */
  function network(id) {
    if (CONF.kind === 'adfit') {
      const unit = CONF.adfit.units[id];
      if (!unit) return null;
      const ins = document.createElement('ins');
      ins.className = 'kakao_ad_area';
      ins.style.display = 'none';
      ins.setAttribute('data-ad-unit', unit);
      ins.setAttribute('data-ad-width', '320');
      ins.setAttribute('data-ad-height', '100');
      return ins;
    }
    if (CONF.kind === 'adsense') {
      if (!CONF.adsense.client || !CONF.adsense.slots[id]) return null;
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', CONF.adsense.client);
      ins.setAttribute('data-ad-slot', CONF.adsense.slots[id]);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      return ins;
    }
    return null;
  }

  let libLoaded = false;
  function loadLib() {
    if (libLoaded || CONF.kind === 'none') return;
    libLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    if (CONF.kind === 'adfit') s.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    else s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CONF.adsense.client;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }

  /* 화면에 그려진 빈 자리를 찾아 채운다.
     다시 그려질 때마다 불려도 안전하다 — 이미 찬 자리는 건너뛴다. */
  function mount(root) {
    const scope = root || document;
    scope.querySelectorAll('.adslot:not(.is-filled)').forEach((el) => {
      const id = el.getAttribute('data-ad');
      const tag = network(id);
      if (tag) {
        loadLib();
        el.appendChild(tag);
        if (CONF.kind === 'adsense') {
          try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
        }
      } else {
        el.insertAdjacentHTML('beforeend', house(id));
      }
      el.classList.add('is-filled');
    });
  }

  return { slot, mount, CONF };
})();

if (typeof module !== 'undefined') module.exports = Ads;
