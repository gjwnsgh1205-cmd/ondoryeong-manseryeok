/* story.html 의 classic <script src> 체인을 window 환경에서 로드한다.
   Node require 가 아니라 파일 텍스트를 vm 으로 실행한다. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'story.html'), 'utf8');
const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);

function el() {
  const e = {
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {},
    innerHTML: '',
    textContent: '',
    value: '',
    hidden: false,
    onclick: null,
    width: 390,
    height: 200,
    children: [],
    querySelector() { return el(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    prepend(c) { this.children.unshift(c); return c; },
    remove() {},
    focus() {},
    click() {},
    play() { return Promise.resolve(); },
    pause() {},
    setAttribute() {},
    getAttribute() { return ''; },
    getContext() {
      const n = function () { return ctx; };
      const ctx = {
        fillRect: n, strokeRect: n, fillText: n, beginPath: n, closePath: n,
        moveTo: n, lineTo: n, quadraticCurveTo: n, bezierCurveTo: n,
        arc: n, save: n, restore: n, translate: n, rotate: n, scale: n,
        setTransform: n, resetTransform: n, clearRect: n, drawImage: n,
        fill: n, stroke: n, clip: n, setLineDash: n,
        measureText() { return { width: 10 }; },
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, globalAlpha: 1,
        textAlign: 'left',
      };
      return ctx;
    },
    getBoundingClientRect() { return { top: 0, left: 0, width: 390, height: 200 }; },
  };
  return e;
}

const els = {};
const document = {
  getElementById(id) { return els[id] || (els[id] = el()); },
  createElement() { return el(); },
  querySelector() { return el(); },
  querySelectorAll() { return []; },
  addEventListener() {},
  head: { appendChild() {} },
  body: el(),
  documentElement: { style: { setProperty() {} }, classList: { toggle() {} } },
};

const windowObj = {
  document,
  console,
  innerHeight: 844,
  innerWidth: 390,
  scrollY: 0,
  scrollTo() {},
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
  requestAnimationFrame(fn) { return setTimeout(fn, 16); },
  cancelAnimationFrame(id) { clearTimeout(id); },
  matchMedia() { return { matches: true, addEventListener() {} }; },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  HTMLElement: function HTMLElement() {},
};
windowObj.window = windowObj;
windowObj.self = windowObj;
windowObj.globalThis = windowObj;

const sandbox = vm.createContext(windowObj);

let fail = 0;
for (const rel of srcs) {
  const file = path.join(ROOT, rel);
  const code = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: rel });
    console.log('  ✓ load ' + rel);
  } catch (err) {
    fail++;
    console.log('  ✗ load ' + rel + ' — ' + err.message);
    if (rel.indexOf('story-app') >= 0) console.log((err.stack || '').split('\n').slice(0, 8).join('\n'));
  }
}

const names = ['Manse', 'Josa', 'Report', 'Story', 'Toon', 'Intro'];
for (const n of names) {
  let t = 'undefined';
  try { t = vm.runInContext('typeof ' + n, sandbox); } catch (e) { t = 'throw'; }
  if (t === 'object' || t === 'function') console.log('  ✓ global ' + n);
  else { fail++; console.log('  ✗ global ' + n + ' — ' + t); }
}

if (sandbox.Story && sandbox.Story.PRICE !== 30000) {
  fail++; console.log('  ✗ PRICE 30000');
} else if (sandbox.Story) console.log('  ✓ PRICE 30000');

console.log(fail ? '\n실패 ' + fail : '\n스크립트 체인 로드 성공');
process.exit(fail ? 1 : 0);
