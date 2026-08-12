/* ============================================================
   sky.js — 배경에 뿌리는 점.

   원래는 밤하늘이었다. 남색 바탕에 흰 별, 금 별.
   바탕을 흰 종이로 내리면서 그 별들이 안 보이게 됐다.

   지워도 됐지만 남겼다. 만세력은 하늘을 재서 만든 책이고,
   그 시차(視差)로 스크롤할 때 화면이 살아 있는 느낌이 난다.
   대신 별을 뒤집었다 — 흰 점이 아니라 먹점이다. 한지의 결처럼 보인다.
   알파를 크게 낮춰서 글자와 다투지 않게 했다.

   배터리를 먹지 않게: 탭이 가려지면 멈추고, 모션을 줄인 사용자에겐 정지 화면을 준다.
   ============================================================ */
(() => {
  'use strict';

  const cv = document.getElementById('sky');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let raf = 0, last = 0, t = 0;

  function seedRand(seed) {
    // 새로고침해도 같은 하늘이 뜨도록 — 별자리는 매번 바뀌면 안 된다
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function build() {
    const rand = seedRand(20260208);
    const area = (W * H) / (dpr * dpr);
    const n = Math.min(220, Math.max(70, Math.round(area / 9000)));
    stars = [];
    for (let i = 0; i < n; i++) {
      const big = rand() > 0.93;
      stars.push({
        x: rand(), y: rand(),
        r: (big ? 1.2 + rand() * 1.1 : 0.4 + rand() * 0.7) * dpr,
        // 흰 종이 위의 먹점이다. 밤하늘에 쓰던 알파(0.25~0.8)를 그대로 두면
        // 글 읽는 데 방해가 된다. 5분의 1 로 눌렀다.
        a: 0.05 + rand() * 0.11,
        // 깜빡임 주기와 위상을 별마다 다르게
        sp: 0.15 + rand() * 0.5,
        ph: rand() * Math.PI * 2,
        // 앞뒤로 층을 나눠 스크롤 시 시차가 생기게
        z: big ? 1 : 0.45 + rand() * 0.4,
        gold: big && rand() > 0.55,
      });
    }
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(window.innerWidth * dpr);
    H = Math.round(window.innerHeight * dpr);
    cv.width = W; cv.height = H;
    build();
    draw(0);
  }

  function draw(scrollY) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      // 스크롤에 따라 층별로 다르게 밀린다 (별이 화면을 벗어나면 반대편으로 감는다)
      const y = ((s.y * H - scrollY * s.z * 0.12 * dpr) % H + H) % H;
      const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(t * s.sp + s.ph);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.gold ? '#9A7A38' : '#2B3040';
      ctx.beginPath();
      ctx.arc(s.x * W, y, s.r, 0, Math.PI * 2);
      ctx.fill();

      if (s.gold) {
        ctx.globalAlpha = s.a * tw * 0.16;
        ctx.beginPath();
        ctx.arc(s.x * W, y, s.r * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = 0;
    // 12fps. 별이 천천히 깜빡이는 데 30fps도 과하고, 리포트는 몇 분씩 읽는 화면이라
    // 전체 화면 캔버스를 계속 다시 그리면 모바일 배터리를 그대로 먹는다.
    if (now - last >= 84) { t = now / 1000; last = now; draw(window.scrollY || 0); }
    schedule();
  }

  function schedule() {
    if (raf || document.hidden || reduce) return;
    raf = requestAnimationFrame(loop);
  }

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 160); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  // 모션을 줄인 사용자에게도 스크롤 시차는 준다 (움직임이 아니라 위치이므로)
  if (reduce) window.addEventListener('scroll', () => draw(window.scrollY || 0), { passive: true });

  resize();
  schedule();
})();
