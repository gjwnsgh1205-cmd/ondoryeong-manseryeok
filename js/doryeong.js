/* ============================================================
 * 온도령(溫道令) — 캐릭터 레이어 (doryeong.js)
 * "마음의 온도를 살피는 젊은 사주 도령"
 *
 * 캐릭터는 부위별 관절 그룹으로 나뉜 인라인 SVG다.
 * 애니메이션은 CSS에서 관절 회전(rotate)으로 준다 — 통짜 이동(translate)이 아니라
 * 어깨·목·허리·손목이 각각 돌아야 살아있는 것처럼 보인다.
 *
 * 모드(자세):  idle(대기) / reading(책 넘김) / reveal(풀이 공개) / bow(배웅)
 * 오라(속성):  el0 목 · el1 화 · el2 토 · el3 금 · el4 수  — 일간 오행에 따라 붙는다
 * ============================================================ */

const Doryeong = (() => {

  /**
   * 캐릭터 미디어 — 움직이는 컷(mp4)이 있으면 그걸, 없으면 정지 일러스트(png)로 자연스럽게 내려간다.
   * poster를 항상 깔아두므로 mp4가 없거나 감속 설정이면 정지 이미지가 그대로 보인다.
   *
   * @param {Object} o {kind:'idle'|'reading'|'reveal'|'bow', loop, cls, label}
   */
  function media(o = {}) {
    const kind = o.kind || 'idle';
    const png = `assets/web/doryeong-${kind}.png`;
    const mp4 = `assets/video/doryeong-${kind}.mp4`;
    const loop = o.loop !== false;
    const label = o.label || '';
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';

    // poster는 영상 첫 프레임이라 재생 전후로 그림이 튀지 않는다.
    // 마스크를 지원하지 않는 브라우저에서는 CSS가 영상을 숨기고 이 투명 PNG를 대신 보여준다.
    const poster = `assets/video/doryeong-${kind}.jpg`;
    const still = `<img class="dr-still" src="${png}" alt="${label}" ${label ? '' : 'aria-hidden="true"'}>`;

    // autoplay를 붙이지 않는다 — 재생은 app.js가 화면 상태에 맞춰 직접 켜고 끈다.
    const video = `<video class="dr-media" ${a11y}
      muted playsinline ${loop ? 'loop' : ''} preload="none" poster="${poster}"
      data-kind="${kind}" data-loop="${loop}"><source src="${mp4}" type="video/mp4"></video>`;

    return `<div class="dr-frame ${o.cls || ''}">${still}${video}</div>`;
  }

  /**
   * 캐릭터 SVG (에셋 로드 전 대체용 · 저사양 폴백)
   * @param {Object} o {size, mode:'idle'|'reading'|'reveal'|'bow', el:0~4|null, decorative:boolean}
   */
  function svg(o = {}) {
    const size = o.size || 200;
    const mode = o.mode || 'idle';
    const el = (o.el === 0 || o.el) ? o.el : null;
    const deco = o.decorative !== false; // 기본은 장식(스크린리더 무시) — 대표 1개만 false
    const a11y = deco
      ? 'aria-hidden="true" focusable="false"'
      : 'role="img" aria-label="온도령 캐릭터"';

    return `
<svg class="doryeong dr-mode-${mode}${el !== null ? ' dr-el-' + el : ''}" width="${size}"
     viewBox="0 0 240 300" ${a11y} xmlns="http://www.w3.org/2000/svg">

  <!-- ===== 오행 오라 (일간 속성) ===== -->
  <g class="dr-aura">
    <circle class="dr-aura-ring" cx="120" cy="150" r="86"/>
    <g class="dr-motes">
      <circle class="dr-mote m1" cx="46"  cy="150" r="3.4"/>
      <circle class="dr-mote m2" cx="196" cy="128" r="2.6"/>
      <circle class="dr-mote m3" cx="62"  cy="92"  r="2.2"/>
      <circle class="dr-mote m4" cx="184" cy="196" r="3"/>
      <circle class="dr-mote m5" cx="120" cy="56"  r="2.4"/>
      <circle class="dr-mote m6" cx="56"  cy="212" r="2.8"/>
    </g>
  </g>

  <!-- ===== 몸통 (허리 관절에서 호흡·인사) ===== -->
  <g class="dr-body">

    <!-- 도포 -->
    <path class="dr-robe" d="M 80 172 Q 120 158 160 172 L 178 258 Q 120 272 62 258 Z" fill="#35566b"/>
    <path d="M 160 172 L 178 258 Q 150 266 138 264 L 147 180 Z" fill="#2c485c"/>
    <!-- 도포 자락 (바람) -->
    <path class="dr-hem" d="M 62 258 Q 120 272 178 258 L 178 264 Q 120 278 62 264 Z" fill="#294253"/>

    <!-- 왼팔 (어깨 관절 회전) -->
    <g class="dr-arm dr-arm-l">
      <path d="M 80 172 Q 54 202 62 236 Q 84 244 98 234 Q 90 204 96 184 Z" fill="#3d617a"/>
      <ellipse class="dr-hand" cx="102" cy="216" rx="7" ry="6" fill="#f3ddc2"/>
    </g>
    <!-- 오른팔 (어깨 관절 회전) -->
    <g class="dr-arm dr-arm-r">
      <path d="M 160 172 Q 186 202 178 236 Q 156 244 142 234 Q 150 204 144 184 Z" fill="#2c485c"/>
      <ellipse class="dr-hand" cx="138" cy="216" rx="7" ry="6" fill="#f3ddc2"/>
    </g>

    <!-- 만세력 책 (손목에서 미세 회전, 책장 넘김) -->
    <g class="dr-book">
      <rect x="100" y="200" width="40" height="30" rx="3" fill="#8a6d3b" stroke="#6f5730" stroke-width="1.5"/>
      <rect x="103" y="203" width="34" height="24" rx="1.5" fill="#efe6d0"/>
      <path class="dr-page" d="M 120 203 L 137 203 L 137 227 L 120 227 Z" fill="#f7f1e2"/>
      <rect x="117" y="200" width="6" height="30" fill="#c9a227" opacity="0.85"/>
      <path d="M 106 210 h 9 M 106 216 h 9 M 106 222 h 7" stroke="#b9ab8c" stroke-width="1.4" stroke-linecap="round"/>
    </g>

    <!-- 깃(동정) · 고름 -->
    <path d="M 94 170 L 120 190 L 146 170 L 138 162 L 120 176 L 102 162 Z" fill="#efe8d8"/>
    <path d="M 120 190 q -6 14 -2 24" stroke="#c9a227" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 120 190 q 8 12 4 22" stroke="#b08d24" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- 목 -->
    <rect x="114" y="152" width="12" height="10" fill="#e6c6a4"/>

    <!-- ===== 머리 (목 관절에서 끄덕·기울임) ===== -->
    <g class="dr-head">
      <!-- 얼굴 -->
      <circle cx="120" cy="124" r="33" fill="#f3ddc2"/>
      <!-- 귀 -->
      <ellipse cx="88" cy="126" rx="4" ry="6" fill="#eccfae"/>
      <ellipse cx="152" cy="126" rx="4" ry="6" fill="#eccfae"/>
      <!-- 앞머리 · 귀밑머리 -->
      <path d="M 89 110 Q 120 92 151 110 Q 120 122 89 110 Z" fill="#2a2118"/>
      <path d="M 90 108 q -3 10 1 18" stroke="#2a2118" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M 150 108 q 3 10 -1 18" stroke="#2a2118" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- 갓 -->
      <path d="M 88 92 L 96 44 Q 120 36 144 44 L 152 92 Z" fill="#17130e"/>
      <ellipse cx="120" cy="92" rx="64" ry="13" fill="#17130e"/>
      <rect x="92" y="84" width="56" height="4" rx="2" fill="#c9a227" opacity="0.5"/>
      <!-- 갓끈 -->
      <path class="dr-strap" d="M 94 100 C 96 128 106 148 118 155" stroke="#4a3d2c" stroke-width="2" fill="none"/>
      <path class="dr-strap dr-strap-r" d="M 146 100 C 144 128 134 148 122 155" stroke="#4a3d2c" stroke-width="2" fill="none"/>
      <!-- 눈썹 -->
      <path class="dr-brow dr-brow-l" d="M 101 119 q 7 -5 15 -2" stroke="#3a2f22" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path class="dr-brow dr-brow-r" d="M 124 117 q 8 -3 15 2" stroke="#3a2f22" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- 눈 -->
      <g class="dr-eyes">
        <ellipse class="dr-eye" cx="109" cy="129" rx="3.3" ry="3.8" fill="#2a2118"/>
        <ellipse class="dr-eye" cx="131" cy="129" rx="3.3" ry="3.8" fill="#2a2118"/>
        <circle class="dr-spark" cx="110.4" cy="127.6" r="1.1" fill="#fff" opacity=".85"/>
        <circle class="dr-spark" cx="132.4" cy="127.6" r="1.1" fill="#fff" opacity=".85"/>
      </g>
      <!-- 입 -->
      <path class="dr-mouth" d="M 113 142 q 7 6 14 0" stroke="#b07a52" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- 볼 -->
      <ellipse cx="98" cy="137" rx="5" ry="3" fill="#e5a97f" opacity="0.42"/>
      <ellipse cx="142" cy="137" rx="5" ry="3" fill="#e5a97f" opacity="0.42"/>
    </g>
  </g>
</svg>`;
  }

  // ---------- 멘트 ----------
  const GREET = '어서 오시게. 나는 마음의 온도를 살피는 온도령이라 하네.\n자네가 태어난 날과 시각을 알려주면, 그날의 하늘을 함께 읽어보겠네.';

  const LOADING = '어디 보자…, 만세력을 넘겨보는 중이라네';

  // 일간별 풀이 도입 대사
  const INTRO_BY_STEM = [
    '음, 곧게 뻗은 큰 나무의 기운이구먼. 자네, 꺾이는 것보다 멈춰 서는 걸 더 못 견디지 않는가.',       // 甲
    '바람 따라 휘어도 끝내 살아남는 들풀의 기운일세. 그 부드러움이 실은 자네의 힘이라네.',              // 乙
    '오, 태양의 기운이라. 자네가 들어서면 방이 환해진다는 말, 종종 듣지 않는가.',                       // 丙
    '촛불의 기운이로군. 화려하진 않아도 오래, 깊게 타는 불이라네. 가까운 이들은 알고 있을 걸세.',        // 丁
    '큰 산의 기운이구먼. 다들 자네에게 기대어 쉬어 가지. 정작 자네는 어디에 기대는가.',                 // 戊
    '기름진 밭의 기운일세. 무엇이든 심으면 자라나게 하는 손을 가졌군.',                                 // 己
    '단단한 강철의 기운이라. 맺고 끊음이 칼 같겠구먼. 그 칼날을 자네 자신에게 너무 자주 겨누지는 마시게.', // 庚
    '곱게 세공된 보석의 기운이로군. 그 예민한 감각은 재능이자 짐이라네.',                               // 辛
    '넓고 깊은 바다의 기운이구먼. 다 품어주는 듯하다가도, 좀처럼 속은 보이지 않지.',                    // 壬
    '만물을 적시는 이슬비의 기운일세. 조용히 스며들어 사람을 얻는 이로군.',                             // 癸
  ];

  // 섹션 도입 브릿지
  const BRIDGES = {
    pillars: '자, 이것이 자네가 태어난 순간의 하늘 — 사주 명식이라네.',
    elements: '이번엔 다섯 기운이 어디로 흐르는지 보겠네.',
    daymaster: '이제 자네라는 사람의 중심을 읽어보지.',
    daeun: '삶은 십 년마다 계절이 바뀐다네. 자네의 계절을 짚어보겠네.',
    concerns: '요즘 마음이 머무는 곳이 있는가. 골라 보시게. 함께 들여다보겠네.',
  };

  // 오늘의 한 마디 (십성 그룹별)
  const TODAY = {
    '비겁': '오늘은 내 걸음을 지키는 날일세. 남과 견주지 말고 어제의 자네와만 견주어 보시게.',
    '식상': '오늘은 표현이 잘 풀리는 날이라네. 미뤄둔 말, 미뤄둔 글을 꺼내기 좋지.',
    '재성': '오늘은 눈이 밝아지는 날이구먼. 미뤄둔 정리와 실무를 해치우기 좋다네.',
    '관성': '오늘은 책임이 또렷해지는 날일세. 할 일 하나를 매듭지으면 마음이 한결 가벼워질 걸세.',
    '인성': '오늘은 안을 채우는 날이라네. 배우고, 읽고, 쉬는 것이 곧 나아가는 것일세.',
  };

  const CLOSING = '오늘 풀이는 여기까지일세.\n사주는 정해진 길이 아니라, 자네가 걸어갈 길의 지도일 뿐 — 지도를 쥔 손은 늘 자네 것이라네.\n마음이 많이 무거운 날엔 혼자 견디지 말고, 믿을 만한 사람이나 전문가에게 도움을 청하시게. 부디 평안히 가시게.';

  // 오행 이름 (오라 라벨)
  const EL_LABEL = ['목木', '화火', '토土', '금金', '수水'];

  function resultIntro(chart) { return INTRO_BY_STEM[chart.dayStem]; }
  function todayLine(sipGroup) { return TODAY[sipGroup] || TODAY['인성']; }

  return { svg, media, GREET, LOADING, BRIDGES, CLOSING, EL_LABEL, resultIntro, todayLine };
})();

if (typeof module !== 'undefined') module.exports = Doryeong;
