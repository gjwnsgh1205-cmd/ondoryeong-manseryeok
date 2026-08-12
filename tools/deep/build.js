/* ============================================================
   build.js — tools/deep/*.json 을 js/content-deep.js 로 굽는다.

   왜 나눠 뒀나. 4만 자를 한 파일에 쓰면 고칠 때마다 전체를 건드려야 한다.
   장별로 나눠 두면 한 장만 다시 써서 얹을 수 있다.

   두 갈래로 나간다.
     box 가 'chartOnly' 가 아니면 → **축(軸)** 에 걸린다.
       같은 일간·계절이거나 같은 십성 열쇠를 가진 사람이면 누구나 이 글을 본다.
     box 가 'chartOnly' 면 → **이 명식에만** 걸린다.
       대운 열 줄은 태어난 때마다 다르니 축으로 묶을 수가 없다.

   쓰는 법:  node tools/deep/build.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT = path.join(DIR, '..', '..', 'js', 'content-deep.js');

/* 이 깊은 글이 걸리는 명식. 여덟 글자를 이어 붙인 것이 열쇠다. */
const CHART_KEY = '경오정해갑진정묘';

const byBox = {};
const chartOnly = {};
let chars = 0, paras = 0, files = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const ch = { title: d.title, lead: d.lead, paras: d.paras };
  chars += (d.paras || []).join('').length + (d.title || '').length + (d.lead || '').length;
  paras += (d.paras || []).length;
  files += 1;
  if (d.box === 'chartOnly') chartOnly[d.key] = ch;
  else {
    byBox[d.box] = byBox[d.box] || {};
    byBox[d.box][d.key] = ch;
  }
}

const pack = { ...byBox, charts: { [CHART_KEY]: chartOnly } };

fs.writeFileSync(OUT,
  '/* 자동 생성 — tools/deep/build.js 가 만든다. 손으로 고치지 마라.\n'
  + '   고칠 것은 tools/deep/*.json 이다.\n\n'
  + `   ${files}편 ${paras}문단 ${chars.toLocaleString()}자.\n`
  + '   축에 걸리는 글은 같은 열쇠를 가진 사람이면 누구나 본다.\n'
  + `   charts['${CHART_KEY}'] 아래 것은 그 명식에만 나간다(대운은 태어난 때마다 달라서다). */\n`
  + 'const ContentDeep = ' + JSON.stringify(pack, null, 1)
  + ';\n\nif (typeof module !== \'undefined\') module.exports = ContentDeep;\n', 'utf8');

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`js/content-deep.js — ${files}편 ${paras}문단 ${chars.toLocaleString()}자 (${kb}KB)`);
for (const [b, o] of Object.entries(byBox)) console.log(`  축  ${b.padEnd(12)} ${Object.keys(o).join(', ')}`);
console.log(`  명식 ${CHART_KEY} → ${Object.keys(chartOnly).join(', ')}`);
