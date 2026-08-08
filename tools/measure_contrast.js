/* ============================================================
   measure_contrast.js — 화면에 실제로 그려진 색으로 대비를 잰다.

   눈대중으로 정한 색은 믿을 게 못 된다. 밤하늘에서 흰 종이로 옮길 때
   눈으로는 멀쩡해 보이던 자리가 53곳이나 AA 에 못 미쳤다.

   토큰 값을 계산기에 넣는 것으로는 안 잡힌다. 실제 배경은 겹쳐서 만들어지기
   때문이다 — 반투명 딱지가 한지 카드 위에 얹히고, 그 카드는 흰 바탕 위에 있다.
   그래서 브라우저가 그린 결과에서 색을 읽고, 알파를 아래로 합성해 내려간다.

   쓰는 법:  브라우저 콘솔에 이 파일 내용을 붙여 넣고 measureContrast() 호출.
             또는 tools/audit.sh 가 gstack browse 로 주입한다.
   ============================================================ */
(function (root) {
  'use strict';

  const parse = (c) => {
    const n = (c || '').match(/[\d.]+/g);
    if (!n) return null;
    return { r: +n[0], g: +n[1], b: +n[2], a: n.length > 3 ? +n[3] : 1 };
  };

  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  /* 조상을 타고 올라가며 반투명 배경을 차례로 합성한다.
     여기를 건너뛰면 rgba(198,161,91,.18) 을 불투명한 금색으로 잘못 읽어
     멀쩡한 자리를 실패로 잡는다. 실제로 한 번 속았다. */
  function effectiveBg(el) {
    const stack = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
      n = n.parentElement;
    }
    let out = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (out.a < 1) out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  }

  function measureContrast(scope) {
    const nodes = document.querySelectorAll(scope || 'body *');
    const fails = [];
    let checked = 0;

    for (const el of nodes) {
      if (el.children.length) continue;                 // 잎 노드만 — 글자를 직접 가진 것
      if (!(el.textContent || '').trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      checked++;

      const bg = effectiveBg(el);
      const solid = fg.a < 1 ? over(fg, bg) : fg;
      const [hi, lo] = [lum(solid), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);

      const size = parseFloat(cs.fontSize);
      const bold = +cs.fontWeight >= 700;
      // WCAG 의 "큰 글자" 기준: 24px 이상, 또는 굵은 글씨 18.66px 이상
      const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;

      if (ratio < need) {
        fails.push({
          sel: (el.className || el.tagName).toString().split(' ')[0],
          ratio: +ratio.toFixed(2),
          need,
          px: +size.toFixed(0),
          fg: cs.color,
          bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
          text: (el.textContent || '').trim().slice(0, 30),
        });
      }
    }

    const uniq = [];
    const seen = new Set();
    for (const f of fails) { if (!seen.has(f.sel)) { seen.add(f.sel); uniq.push(f); } }
    return { checked, failed: fails.length, kinds: uniq };
  }

  root.measureContrast = measureContrast;
  if (typeof module !== 'undefined') module.exports = { measureContrast };
})(typeof window !== 'undefined' ? window : globalThis);
