/* ============================================================
 * 온도령(溫道令) — 캐릭터 레이어 (doryeong.js)
 * "마음의 온도를 살피는 젊은 사주 도령"
 * - 플랫 벡터 SVG 캐릭터 (외부 이미지 의존 없음)
 * - 도령 말투 멘트: 인사 / 풀이 도입(일간별) / 섹션 브릿지 / 오늘 한마디 / 맺음말
 * 말투 규칙: 옛스러운 다정체(하게체). 상담 본문(counsel.js)은 존댓말 유지 —
 *            도령이 "책을 풀어 읽어주는" 프레임이므로 층위가 다르다.
 * ============================================================ */

const Doryeong = (() => {

  // ---------- 캐릭터 SVG ----------
  // size: 렌더 폭(px). 갓+도포+만세력 책을 든 젊은 선비.
  function svg(size = 200, cls = '') {
    return `
<svg class="doryeong ${cls}" width="${size}" viewBox="0 0 220 270" role="img" aria-label="온도령 캐릭터" xmlns="http://www.w3.org/2000/svg">
  <!-- 도포 -->
  <path d="M 70 160 Q 110 146 150 160 L 168 240 Q 110 254 52 240 Z" fill="#35566b"/>
  <path d="M 150 160 L 168 240 Q 140 248 128 246 L 137 168 Z" fill="#2c485c"/>
  <!-- 소매 -->
  <path d="M 70 160 Q 44 190 52 224 Q 74 232 88 222 Q 80 192 86 172 Z" fill="#3d617a"/>
  <path d="M 150 160 Q 176 190 168 224 Q 146 232 132 222 Q 140 192 134 172 Z" fill="#2c485c"/>
  <!-- 깃(동정) -->
  <path d="M 84 158 L 110 178 L 136 158 L 128 150 L 110 164 L 92 150 Z" fill="#efe8d8"/>
  <!-- 고름 -->
  <path d="M 110 178 q -6 14 -2 24" stroke="#c9a227" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 110 178 q 8 12 4 22" stroke="#b08d24" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 만세력 책 + 손 -->
  <rect x="92" y="190" width="36" height="26" rx="3" fill="#8a6d3b" stroke="#6f5730" stroke-width="1.5"/>
  <rect x="95" y="193" width="30" height="20" rx="1.5" fill="#efe6d0"/>
  <rect x="106" y="190" width="8" height="26" fill="#c9a227" opacity="0.8"/>
  <ellipse cx="92" cy="204" rx="6" ry="5" fill="#f3ddc2"/>
  <ellipse cx="128" cy="204" rx="6" ry="5" fill="#f3ddc2"/>
  <!-- 목 -->
  <rect x="104" y="140" width="12" height="10" fill="#ecd2b3"/>
  <!-- 얼굴 -->
  <circle cx="110" cy="112" r="33" fill="#f3ddc2"/>
  <!-- 앞머리 -->
  <path d="M 79 98 Q 110 80 141 98 Q 110 110 79 98 Z" fill="#2a2118"/>
  <!-- 귀밑머리 -->
  <path d="M 80 96 q -3 10 1 18" stroke="#2a2118" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 140 96 q 3 10 -1 18" stroke="#2a2118" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 갓 -->
  <path d="M 78 80 L 86 34 Q 110 26 134 34 L 142 80 Z" fill="#17130e"/>
  <ellipse cx="110" cy="80" rx="64" ry="13" fill="#17130e"/>
  <rect x="82" y="72" width="56" height="4" rx="2" fill="#c9a227" opacity="0.5"/>
  <!-- 눈썹 · 눈 · 입 · 볼 -->
  <path d="M 91 107 q 7 -5 15 -2" stroke="#3a2f22" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M 114 105 q 8 -3 15 2" stroke="#3a2f22" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse class="dr-eye" cx="99" cy="117" rx="3.2" ry="3.6" fill="#2a2118"/>
  <ellipse class="dr-eye" cx="121" cy="117" rx="3.2" ry="3.6" fill="#2a2118"/>
  <path d="M 103 130 q 7 6 14 0" stroke="#b07a52" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="88" cy="125" rx="5" ry="3" fill="#e5a97f" opacity="0.4"/>
  <ellipse cx="132" cy="125" rx="5" ry="3" fill="#e5a97f" opacity="0.4"/>
</svg>`;
  }

  // ---------- 멘트 ----------
  const GREET = '어서 오시게. 나는 마음의 온도를 살피는 온도령이라 하네.\n자네가 태어난 날을 알려주면, 그날의 하늘을 함께 읽어보겠네.';

  const LOADING = '어디 보자…, 만세력을 넘겨보는 중이라네.';

  // 일간별 풀이 도입 대사
  const INTRO_BY_STEM = [
    '허어, 곧게 뻗은 큰 나무의 기운이구먼. 자네, 꺾이는 것보다 멈춰 서는 걸 더 못 견디지 않는가.',        // 甲
    '바람 따라 휘어도 끝내 살아남는 들풀의 기운일세. 그 부드러움이 실은 자네의 힘이라네.',                // 乙
    '허어, 태양의 기운이라. 자네가 들어서면 방이 환해진다는 말, 종종 듣지 않는가.',                       // 丙
    '촛불의 기운이로군. 화려하진 않아도 오래, 깊게 타는 불이라네. 가까운 이들은 알고 있을 걸세.',          // 丁
    '큰 산의 기운이구먼. 다들 자네에게 기대어 쉬어 가지. 정작 자네는 어디에 기대는가.',                   // 戊
    '기름진 밭의 기운일세. 무엇이든 심으면 자라나게 하는 손을 가졌군.',                                   // 己
    '단단한 강철의 기운이라. 맺고 끊음이 칼 같겠구먼. 그 칼, 자신에게는 너무 자주 겨누지 마시게.',        // 庚
    '곱게 세공된 보석의 기운이로군. 그 예민한 감각은 재능이자 짐이라네.',                                 // 辛
    '넓고 깊은 바다의 기운이구먼. 다 품어주는 듯하다가도, 좀처럼 속은 보이지 않지.',                      // 壬
    '만물을 적시는 이슬비의 기운일세. 조용히 스며들어 사람을 얻는 이로군.',                               // 癸
  ];

  // 섹션 도입 브릿지 (도령의 한 줄)
  const BRIDGES = {
    pillars: '자, 이것이 자네가 태어난 순간의 하늘 — 사주 명식이라네.',
    elements: '이번엔 다섯 기운이 어디로 흐르는지 보겠네.',
    daymaster: '이제 자네라는 사람의 중심을 읽어보지.',
    daeun: '삶은 십 년마다 계절이 바뀐다네. 자네의 계절을 짚어보겠네.',
    concerns: '요즘 마음이 머무는 곳이 있는가. 골라 보시게, 같이 들여다볼 테니.',
  };

  // 오늘의 한 마디 (십성 그룹별, 도령체)
  const TODAY = {
    '비겁': '오늘은 내 걸음을 지키는 날일세. 남과 견주지 말고 어제의 자네와만 견주어 보시게.',
    '식상': '오늘은 표현이 잘 풀리는 날이라네. 미뤄둔 말, 미뤄둔 글을 꺼내기 좋지.',
    '재성': '오늘은 눈이 밝아지는 날이구먼. 미뤄둔 정리와 실무를 해치우기 좋다네.',
    '관성': '오늘은 책임이 또렷해지는 날일세. 할 일 하나를 매듭지으면 마음이 한결 가벼워질 걸세.',
    '인성': '오늘은 안을 채우는 날이라네. 배우고, 읽고, 쉬는 것이 곧 나아가는 것일세.',
  };

  const CLOSING = '오늘 풀이는 여기까질세.\n사주는 정해진 길이 아니라, 자네가 걸어갈 길의 지도일 뿐 — 지도를 쥔 손은 늘 자네 것이라네.\n마음이 많이 무거운 날엔 혼자 견디지 말고 꼭 사람을 찾으시게. 살펴 가시게.';

  function resultIntro(chart) {
    return INTRO_BY_STEM[chart.dayStem];
  }

  function todayLine(sipGroup) {
    return TODAY[sipGroup] || TODAY['인성'];
  }

  return { svg, GREET, LOADING, BRIDGES, CLOSING, resultIntro, todayLine };
})();

if (typeof module !== 'undefined') module.exports = Doryeong;
