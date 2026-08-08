/* ============================================================
   share.js — 카카오톡으로 나눠 보내기.

   ★ 여기서 가장 중요한 결정 하나 ★
   공유 링크에 **생년월일을 담지 않는다.**
   URL 은 서버 로그·CDN 캐시·브라우저 방문기록·카톡 미리보기 서버에 그대로 남는다.
   한 번 붙여넣은 링크는 지워지지 않는다. 남의 생년월일시가 그렇게 흘러다니면 안 된다.

   대신 **유형 이름만** 담는다.  index.html?t=%ED%95%9C%EC%97%AC%EB%A6%84%EC%9D%98%20%EB%B3%B4%EC%84%9D
   유형은 120가지라 이것만으로는 누구인지 알 수 없고, 받은 사람은
   "이 유형이 어떤 사람인지" 보고서 제 것도 보러 들어온다. 그게 우리가 원하는 고리다.

   카카오 SDK(Kakao.Share.sendDefault)는 앱 키가 있어야 한다.
   키가 붙기 전까지는 Web Share API 로 공유 시트를 열고, 그게 없으면 클립보드로 떨어진다.
   셋 다 같은 링크를 쓰므로 나중에 키만 꽂으면 된다.
   ============================================================ */
const Share = (() => {
  'use strict';

  const KAKAO_KEY = '';   // 카카오 JS 앱 키. 넣으면 카톡 전용 카드로 나간다.

  function base() {
    const u = new URL(location.href);
    u.hash = '';
    u.search = '';
    // /deep.html 등 어디서 눌러도 본체로 보낸다
    u.pathname = u.pathname.replace(/[^/]*$/, 'index.html');
    return u;
  }

  /** 공유 링크 — 유형 이름 하나만 싣는다 */
  function linkFor(typeName) {
    const u = base();
    if (typeName) u.searchParams.set('t', typeName);
    return u.toString();
  }

  /** 받은 사람이 열었을 때 — 링크에 실린 유형 이름 */
  function incoming() {
    try {
      const t = new URL(location.href).searchParams.get('t');
      return t ? String(t).slice(0, 40) : null;
    } catch (e) { return null; }
  }

  function text(rp) {
    const name = rp && rp.type ? rp.type.name : '온도령';
    const head = rp && rp.type ? rp.type.headline : '';
    return `내 사주는 "${name}"이래.\n${head}\n\n네 것도 여덟 글자만 넣으면 나와.`;
  }

  let kakaoReady = null;
  function loadKakao() {
    if (!KAKAO_KEY) return Promise.resolve(false);
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((ok) => {
      if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) return ok(true);
      const s = document.createElement('script');
      s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      s.integrity = 'sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4';
      s.crossOrigin = 'anonymous';
      s.onload = () => {
        try { window.Kakao.init(KAKAO_KEY); ok(true); } catch (e) { ok(false); }
      };
      s.onerror = () => ok(false);
      document.head.appendChild(s);
    });
    return kakaoReady;
  }

  /** 셋 중 되는 것으로 내보낸다: 카카오 → 공유 시트 → 클립보드 */
  async function send(rp) {
    const url = linkFor(rp && rp.type ? rp.type.name : '');
    const body = text(rp);
    const title = rp && rp.type ? `온도령 — ${rp.type.name}` : '온도령 만세력';

    if (KAKAO_KEY && await loadKakao()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title,
            description: (rp && rp.type ? rp.type.headline : '') + '\n네 것도 여덟 글자만 넣으면 나와.',
            imageUrl: new URL('assets/web/doryeong-reveal.png', base()).toString(),
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [{ title: '내 것도 보기', link: { mobileWebUrl: url, webUrl: url } }],
        });
        return 'kakao';
      } catch (e) { /* 아래로 흘린다 */ }
    }

    // 모바일이면 여기서 카톡이 목록에 뜬다
    if (navigator.share) {
      try { await navigator.share({ title, text: body, url }); return 'sheet'; }
      catch (e) {
        if (e && e.name === 'AbortError') return 'cancel';   // 사용자가 닫은 것뿐
      }
    }

    try { await navigator.clipboard.writeText(`${body}\n${url}`); return 'copy'; }
    catch (e) { return 'fail'; }
  }

  return { send, linkFor, incoming, text, hasKakaoKey: () => !!KAKAO_KEY };
})();

if (typeof module !== 'undefined') module.exports = Share;
