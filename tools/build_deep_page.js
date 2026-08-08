/* ============================================================
   build_deep_page.js — 19,800원짜리가 무엇인지 보여주는 상세페이지를 만든다.

   왜 손으로 안 쓰고 스크립트로 만드는가:
   이 페이지의 왼쪽(무료 쪽)은 실제 엔진이 내는 글을 그대로 붙인다.
   손으로 베껴 두면 content.js 를 고칠 때마다 페이지가 슬그머니 거짓말이 된다.
   "이게 무료로 나오는 글입니다" 라고 해놓고 실제로는 다른 글이 나오면 그 순간 신뢰가 끝난다.

     node tools/build_deep_page.js
   결과: deep.html
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.Manse = require(path.join(ROOT, 'js/manseryeok.js'));
try { global.Manse.setAstro(require(path.join(ROOT, 'js/vendor/astronomy.browser.min.js'))); } catch (e) {}
global.Content = require(path.join(ROOT, 'js/content.js'));
const Report = require(path.join(ROOT, 'js/report.js'));
const EX = require(path.join(__dirname, 'deep_example.json'));

/* 예시로 쓰는 사람 — 실제로 계산되는 명식이다. 지어낸 사주가 아니다. */
const WHO = { year: 1989, month: 9, day: 7, hour: 14, minute: 20, gender: 'F' };

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function main() {
  const chart = Manse.compute({ ...WHO, unknownTime: false, useTrueSolar: true });
  const r = Report.build(chart);
  const S = Manse.STEMS, B = Manse.BRANCHES;
  const pil = (k) => (chart.pillars[k]
    ? `${S[chart.pillars[k].stem].han}${B[chart.pillars[k].branch].han}` : '?');
  const shares = Report.groupShares(chart);
  const share = (k) => Math.round((shares[k] || 0) * 100);
  const a = EX.answer;

  const forks = a.forks.map((f, i) => `
    <div class="fork">
      <div class="fork-h"><span class="fork-n">${i === 0 ? '가' : '나'}</span><b>${esc(f.name)}</b></div>
      <dl>
        <dt class="fit">자네 결에 맞는 점</dt><dd>${esc(f.fit)}</dd>
        <dt class="fri">어긋나는 점</dt><dd>${esc(f.friction)}</dd>
        <dt class="go">고른다면</dt><dd>${esc(f.ifYouGo)}</dd>
      </dl>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="description" content="미리 지어둔 글이 아니라, 자네 이야기를 듣고 쓰는 풀이. 온도령 19,800원 풀이가 무엇인지 실제 예시로 봅니다.">
<title>한 번에 제대로 — 온도령</title>
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/deep.css">
</head>
<body>
<canvas id="sky" class="sky" aria-hidden="true"></canvas>

<main class="deep">

  <header class="dp-hero">
    <p class="eyebrow">溫道令 · 한 번에 제대로</p>
    <h1>미리 지어둔 글이<br>아닐세.</h1>
    <p class="dp-sub">
      무료 풀이는 자네 명식에 맞는 글을 골라 보여주는 것이네.
      이건 다르지. 자네가 지금 어떤 자리에 서 있는지 듣고, 그 위에 여덟 글자를 얹어 따로 쓰는 풀이일세.
    </p>
    <div class="dp-price"><b>19,800원</b><span>한 번 받으면 30일 동안 이어 물을 수 있네</span></div>
  </header>

  <section class="dp-sec">
    <h2><span class="dp-num">一</span>무엇이 다른가</h2>
    <p class="dp-lead">같은 사람, 같은 명식일세. 왼쪽은 사정을 모른 채 쓴 글이고, 오른쪽은 듣고 쓴 글이네.</p>
    <div class="dp-vs">
      <div class="vs-col vs-free">
        <span class="vs-tag">무료</span>
        <p class="vs-head">${esc(r.type.headline)}</p>
        <p>${esc(r.type.body)}</p>
        <p class="vs-eg">${esc(r.type.example)}</p>
        <p class="vs-note">명식만 보고 고른 글일세. 맞는 말이지만, 자네가 지금 무엇 때문에 잠 못 드는지는 모르네.</p>
      </div>
      <div class="vs-col vs-paid">
        <span class="vs-tag vs-tag-gold">19,800원</span>
        <p class="vs-head">${esc(a.heard.split('. ')[0])}.</p>
        <p>${esc(a.basis)}</p>
        <p class="vs-note">같은 명식인데 말이 달라졌지. 자네가 무엇을 앞에 두고 있는지 알고 쓴 글이라 그렇다네.</p>
      </div>
    </div>
  </section>

  <section class="dp-sec">
    <h2><span class="dp-num">二</span>여덟 가지를 여쭙네</h2>
    <p class="dp-lead">첫 물음만 답하면 되고 나머지는 건너뛰어도 되네. 많이 일러줄수록 가깝게 쓸 수 있을 뿐일세.</p>
    <ol class="dp-qs">
      ${EX.form.map((f) => `<li><b>${esc(f.q)}</b></li>`).join('')}
    </ol>
    <p class="dp-fine">병명이나 빚 액수 같은 건 묻지 않네. 몸 상태를 여쭙는 것도 자네를 몰아붙이지 않으려는 것뿐일세.</p>
  </section>

  <section class="dp-sec">
    <h2><span class="dp-num">三</span>이분은 이렇게 답하셨네</h2>
    <div class="dp-card dp-said">
      <p class="said-q">지금 가장 마음에 걸리는 일</p>
      <p class="said-a">${esc(EX.form[0].a)}</p>
      <div class="said-chips">
        ${EX.form.slice(1).map((f) => `<span>${esc(f.a.length > 26 ? f.a.slice(0, 26) + '…' : f.a)}</span>`).join('')}
      </div>
    </div>
    <div class="dp-chart">
      <div class="dpc-pillars">
        ${['year', 'month', 'day', 'hour'].map((k) => `<span>${pil(k)}</span>`).join('')}
      </div>
      <div class="dpc-nums">
        <span>식상 <b>${share('식상')}%</b></span>
        <span>관성 <b>${share('관성')}%</b></span>
        <span class="dpc-low">재성 <b>${share('재성')}%</b></span>
        <span>인성 <b>${share('인성')}%</b></span>
      </div>
      <p class="dpc-note">1989년 9월 7일 오후 2시 20분생. 이 숫자는 이 페이지를 만들 때 실제로 계산한 값이네.</p>
    </div>
  </section>

  <section class="dp-sec">
    <h2><span class="dp-num">四</span>온도령은 이렇게 답했네</h2>
    <p class="dp-lead">아래가 19,800원에 받으시는 것일세. 잘라내지 않고 그대로 실었네.</p>

    <div class="dp-card">
      <h3 class="ans-h">들은 이야기</h3>
      <p>${esc(a.heard)}</p>
    </div>

    <div class="dp-card">
      <h3 class="ans-h">자네 명식에서 맞물리는 자리</h3>
      <p>${esc(a.basis)}</p>
    </div>

    <div class="dp-card">
      <h3 class="ans-h">지금이 어떤 때인가</h3>
      <p>${esc(a.timing)}</p>
    </div>

    <div class="dp-forks">
      <h3 class="ans-h ans-h-big">갈림길</h3>
      <p class="dp-lead">어느 쪽이 옳다고 말하지 않네. 저울을 보여드릴 뿐이고, 고르는 건 자네 몫일세.</p>
      ${forks}
    </div>

    <div class="dp-card">
      <h3 class="ans-h">지금 해두실 것</h3>
      <ol class="ans-do">${a.doNow.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    </div>

    <div class="dp-card dp-care">
      <h3 class="ans-h">걸려 넘어지기 쉬운 데</h3>
      <p>${esc(a.careful)}</p>
    </div>

    <div class="dp-card">
      <h3 class="ans-h">언제 다시 펴 보실지</h3>
      <p>${esc(a.revisit)}</p>
    </div>
  </section>

  <section class="dp-sec">
    <h2><span class="dp-num">五</span>어떻게 쓰는가</h2>
    <ol class="dp-how">
      <li><b>계산</b>태양의 황경을 직접 재어 절기가 드는 순간을 초 단위로 잡네. 여기서 어긋나면 남의 사주를 보는 것이지.</li>
      <li><b>명식</b>여덟 글자와 숨은 기운, 십성의 세력, 열 해마다 갈리는 흐름까지 셈하네.</li>
      <li><b>자네 이야기</b>여덟 가지로 받은 사정을 그 위에 얹네. 이 대목이 미리 지어둘 수 없는 자리일세.</li>
      <li><b>풀이</b>둘을 겹쳐 자네에게만 해당하는 말을 쓰네.</li>
    </ol>
  </section>

  <section class="dp-sec dp-buy">
    <div class="dp-anchor">
      <span>동네 점집 10~30만원</span>
      <span>다른 사주 앱 3~8만원</span>
      <span class="dp-us">온도령 19,800원</span>
    </div>
    <a class="dp-cta" href="index.html">내 상황 일러주고 받아보기</a>
    <p class="dp-fine">한 번 받으면 30일 동안 몇 번이든 이어 물을 수 있네.
      매일의 운세만 보시려면 달마다 4,900원짜리도 있다네.</p>
  </section>

  <footer class="site-footer">
    <p>이 풀이는 명리학 이론에 기댄 자기 이해의 거울이며, 의학적 진단이나 심리치료를 대신하지 않습니다.</p>
    <p>마음이 많이 힘든 날에는 <strong>109</strong>(자살예방 상담) 또는 <strong>1577-0199</strong>(정신건강 위기상담)로 전화해 주세요.</p>
  </footer>
</main>

<script src="js/sky.js"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(ROOT, 'deep.html'), html, 'utf8');
  const kb = (fs.statSync(path.join(ROOT, 'deep.html')).size / 1024).toFixed(1);
  console.log(`deep.html 완성 — ${kb}KB`);
  console.log(`  예시 명식 ${pil('year')} ${pil('month')} ${pil('day')} ${pil('hour')} · ${r.type.name}`);
  console.log(`  식상 ${share('식상')}% · 관성 ${share('관성')}% · 재성 ${share('재성')}% · 인성 ${share('인성')}%`);
  console.log('  무료 쪽 글은 엔진에서 그대로 뽑았다 — 손으로 베끼지 않았으므로 어긋날 일이 없다.');
}

main();
