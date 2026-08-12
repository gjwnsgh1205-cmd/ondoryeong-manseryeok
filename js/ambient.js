/* ============================================================
   ambient.js — 화면 뒤에서 계속 흐르는 배경.

   왜 필요한가.
   컷과 컷 사이에 죽은 여백이 생기면 "긴 웹페이지" 가 된다.
   뒤에서 뭔가가 계속 움직이고 있으면 같은 장면 안에 있다는 감각이 유지된다.
   그게 일체감이다.

   무엇이 흐르나. **부적이다.**
   주인공이 손에 들고 던지는 그 물건이 배경에도 떠 있다.
   장식을 새로 만들지 않고 이미 있는 소품을 쓴다 — 그래야 한 세계로 읽힌다.

   지켜야 할 선 셋.
     1. 글을 방해하지 않는다. 밝은 구간에서는 거의 안 보일 만큼 옅다.
     2. 배터리를 먹지 않는다. 탭이 숨으면 멈춘다.
     3. 모션을 줄여달라면 아예 안 움직인다.
   ============================================================ */
const Ambient = (() => {
  'use strict';

  const REDUCED = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cv = null, x = null, raf = 0, bits = [], W = 0, H = 0, dpr = 1;
  let hue = { r: 200, g: 70, b: 60 };     // 지금 배경이 띠는 색. 장마다 갈린다.
  let want = { r: 200, g: 70, b: 60 };    // 가고 싶은 색. 여기로 서서히 끌려간다.
  let lit = 0;                            // 0=어둠 1=빛. 밝은 장에서는 옅어진다.
  let wantLit = 0;

  /* 부적 한 장. 마름모꼴로 그린다 — 그림 속 부적과 같은 모양이다. */
  function seed(first) {
    return {
      x: Math.random() * W,
      y: first ? Math.random() * H : H + 40,
      s: 6 + Math.random() * 14,          // 크기
      v: 0.12 + Math.random() * 0.34,     // 올라가는 속도
      a: Math.random() * Math.PI * 2,     // 기울기
      w: (Math.random() - 0.5) * 0.006,   // 도는 속도
      o: 0.06 + Math.random() * 0.16,     // 진하기
      d: Math.random() * Math.PI * 2,     // 좌우로 흔들리는 위상
    };
  }

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 좁은 화면에서는 수를 줄인다. 폰 배터리를 먹으면 안 된다.
    const n = W < 520 ? 16 : 26;
    bits = Array.from({ length: n }, () => seed(true));
  }

  function draw() {
    // 색과 밝기는 목표값으로 천천히 끌려간다. 장이 바뀔 때 뚝 끊기지 않게.
    hue.r += (want.r - hue.r) * 0.02;
    hue.g += (want.g - hue.g) * 0.02;
    hue.b += (want.b - hue.b) * 0.02;
    lit += (wantLit - lit) * 0.03;

    x.clearRect(0, 0, W, H);
    // 밝은 장(글 읽는 구간)에서는 거의 사라진다. 글이 먼저다.
    const dim = 1 - lit * 0.82;
    const c = `${Math.round(hue.r)},${Math.round(hue.g)},${Math.round(hue.b)}`;

    for (const b of bits) {
      b.y -= b.v;
      b.a += b.w;
      b.d += 0.004;
      const px = b.x + Math.sin(b.d) * 22;      // 좌우로 느리게 흔들린다
      if (b.y < -40) Object.assign(b, seed(false));

      x.save();
      x.translate(px, b.y);
      x.rotate(b.a);
      x.globalAlpha = b.o * dim;
      x.fillStyle = `rgb(${c})`;
      x.shadowColor = `rgb(${c})`;
      x.shadowBlur = b.s * 1.4;
      // 마름모 — 부적 모양
      x.beginPath();
      x.moveTo(0, -b.s); x.lineTo(b.s * 0.42, 0);
      x.lineTo(0, b.s); x.lineTo(-b.s * 0.42, 0);
      x.closePath(); x.fill();
      x.restore();
    }
    raf = requestAnimationFrame(draw);
  }

  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  const go = () => { if (!raf && !REDUCED) raf = requestAnimationFrame(draw); };

  function start() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'ambient';
    cv.setAttribute('aria-hidden', 'true');
    document.body.prepend(cv);
    x = cv.getContext('2d');
    size();
    window.addEventListener('resize', size);
    // 탭이 숨으면 멈춘다. 안 그러면 배경에서 계속 그린다.
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : go()));
    if (REDUCED) { draw(); stop(); return; }   // 한 장만 그리고 세운다
    go();
  }

  /** 장이 바뀔 때 부른다. rgb 는 [r,g,b], light 는 0(어둠)~1(빛) */
  function mood(rgb, light) {
    if (Array.isArray(rgb)) want = { r: rgb[0], g: rgb[1], b: rgb[2] };
    if (typeof light === 'number') wantLit = light;
  }

  return { start, mood };
})();

if (typeof module !== 'undefined') module.exports = Ambient;
