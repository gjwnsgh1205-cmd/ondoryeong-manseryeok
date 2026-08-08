/* ============================================================
   measure_rarity.js — report.js 의 분위수 상수를 실제로 재서 뽑는다.

   report.js 는 "상위 20%", "신강", "왕" 같은 말을 한다.
   그 말이 맞으려면 기준선이 실제 분포에서 나와야 한다. 지어낸 숫자면 거짓말이다.
   이 스크립트가 그 기준선을 만들고, report.js 에 붙여 넣을 블록을 그대로 출력한다.

     node tools/measure_rarity.js            # 표본 20,000
     node tools/measure_rarity.js 50000      # 표본 늘리기
     node tools/measure_rarity.js --write    # report.js 의 MEASURED 블록을 바로 교체

   표본은 난수가 아니라 1955–2011년을 균등 간격으로 훑는다.
   같은 명령이 늘 같은 답을 내야 재현이라 부를 수 있기 때문이다.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.Manse = require(path.join(ROOT, 'js/manseryeok.js'));
try { global.Manse.setAstro(require(path.join(ROOT, 'js/vendor/astronomy.browser.min.js'))); }
catch (e) { console.warn('※ astronomy-engine 을 못 불러와 근사식으로 돈다. 결과가 미세하게 달라진다.'); }
global.Content = require(path.join(ROOT, 'js/content.js'));
const Report = require(path.join(ROOT, 'js/report.js'));

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const N = parseInt(args.find((a) => /^\d+$/.test(a)) || '20000', 10);

const FROM = Date.UTC(1955, 0, 1);
const TO = Date.UTC(2012, 0, 1);

function sample() {
  const skew = [], str = [], shares = { 비겁: [], 식상: [], 재성: [], 관성: [], 인성: [] };
  let ok = 0, skipped = 0;
  for (let i = 0; i < N; i++) {
    const d = new Date(FROM + Math.floor((TO - FROM) * (i / N)));
    try {
      const c = Manse.compute({
        year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
        // 시각도 표본마다 흩뜨린다 — 시주가 늘 같으면 분포가 한쪽으로 눌린다
        hour: (i * 7) % 24, minute: (i * 13) % 60,
        gender: i % 2 ? 'M' : 'F', unknownTime: false, useTrueSolar: true,
      });
      skew.push(Report.skewScore(c.elCount));
      str.push(Report.strengthRatio(c));
      const g = Report.groupShares(c);
      for (const k of Object.keys(shares)) shares[k].push(g[k]);
      ok++;
    } catch (e) { skipped++; }   // 서머타임 공백 시각 등
  }
  return { skew, str, shares, ok, skipped };
}

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

function main() {
  console.log(`표본 ${N}개 계산 중…`);
  const { skew, str, shares, ok, skipped } = sample();
  skew.sort((a, b) => a - b);
  str.sort((a, b) => a - b);
  console.log(`성립 ${ok}개 / 건너뜀 ${skipped}개 (서머타임 공백 등)\n`);

  /* ── 오행 치우침 ── */
  // 위쪽 꼬리부터 훑어 내려가며 "상위 N%" 컷을 만든다
  const tail = [0.5, 1, 2, 5, 10, 20, 30, 40, 50];
  const cuts = tail.map((p) => [+q(skew, 1 - p / 100).toFixed(4), p]);
  const balanced = +q(skew, 0.5).toFixed(4);

  console.log('■ 오행 치우침 (변동계수)');
  console.log(`  최소 ${q(skew, 0).toFixed(4)} · 중앙 ${q(skew, .5).toFixed(4)} · 최대 ${q(skew, 1).toFixed(4)}`);
  tail.forEach((p, i) => console.log(`  상위 ${String(p).padStart(4)}% 컷 = ${cuts[i][0]}`));

  /* ── 일간 강약 ── */
  const weak = +q(str, 0.30).toFixed(4);
  const strong = +q(str, 0.75).toFixed(4);
  const lo = +q(str, 0.02).toFixed(2);
  const hi = +q(str, 0.98).toFixed(2);
  console.log('\n■ 일간 강약 (자리 무게 반영)');
  [.02, .1, .3, .5, .75, .9, .98].forEach((p) =>
    console.log(`  p${String(Math.round(p * 100)).padStart(2)} = ${q(str, p).toFixed(4)}`));
  console.log(`  → 신약 컷(하위 30%) ${weak} · 신강 컷(상위 25%) ${strong}`);

  /* ── 십성 세력 ── */
  // 다섯 그룹 각각의 중앙값을 보고, 대략 절반이 '왕'이 되는 지점을 고른다.
  // 한쪽 문구만 계속 쓰이면 콘텐츠 절반이 죽는다.
  console.log('\n■ 십성 그룹 비중');
  const meds = [];
  for (const k of Object.keys(shares)) {
    const a = shares[k].slice().sort((x, y) => x - y);
    meds.push(q(a, 0.5));
    console.log(`  ${k}  중앙 ${q(a, .5).toFixed(3)} · p75 ${q(a, .75).toFixed(3)} · p90 ${q(a, .9).toFixed(3)}`);
  }
  const dominant = +(meds.reduce((a, b) => a + b, 0) / meds.length).toFixed(2);
  console.log(`  → '왕' 컷 = 다섯 그룹 중앙값의 평균 ${dominant} (인구 절반이 이 위)`);

  const block = `  const SKEW_CUTS = [
    ${cuts.slice(0, 4).map(([c, p]) => `[${c}, ${p}]`).join(', ')},
    ${cuts.slice(4).map(([c, p]) => `[${c}, ${p}]`).join(', ')},
  ];
  const BALANCED_CUT = ${balanced};  // 하위 50% — 여기 아래여야 "고르다"고 말한다
  const WEAK_CUT = ${weak};      // 하위 30%
  const STRONG_CUT = ${strong};    // 상위 25%
  const R_LO = ${lo}, R_HI = ${hi};
  const DOMINANT_CUT = ${dominant};    // 이 그룹 비중이 남들 중앙값보다 위면 '왕'`;

  console.log('\n■ report.js 의 MEASURED 블록\n');
  console.log(block);

  if (WRITE) {
    const p = path.join(ROOT, 'js/report.js');
    const src = fs.readFileSync(p, 'utf8');
    // 줄바꿈이 CRLF 일 수도 있으니 표시 문자열만 붙잡는다
    const re = /(\/\* MEASURED:BEGIN \*\/)[\s\S]*?(\/\* MEASURED:END \*\/)/;
    if (!re.test(src)) { console.error('\n× report.js 에서 MEASURED 표시를 못 찾았다.'); process.exit(1); }
    fs.writeFileSync(p, src.replace(re, `$1\n${block}\n  $2`), 'utf8');
    console.log('\n→ js/report.js 의 MEASURED 블록을 갱신했다. 테스트를 다시 돌려라.');
  } else {
    console.log('\n(--write 를 붙이면 report.js 에 바로 반영한다)');
  }
}

main();
