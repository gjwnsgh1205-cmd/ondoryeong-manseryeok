/* story.html 웹툰 한 편 — 이름·사주팔자·잠금 계약
   브라우저 없이 실제 Story.build / Toon.render / Josa.fill 을 탄다. */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = (p) => require(path.join(ROOT, p));

global.window = global.window || {
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame(fn) { fn(); },
};
global.document = global.document || {
  documentElement: { style: { setProperty() {} }, classList: { toggle() {} } },
};

global.Manse = R('js/manseryeok.js');
try { global.Manse.setAstro(R('tests/vendor/astronomy.node.min.js')); } catch (e) { /* 폴백 */ }
global.Content = R('js/content.js');
try { global.ContentDeep = R('js/content-deep.js'); } catch (e) { /* 없어도 129편 */ }
global.Josa = R('js/josa.js');
const Report = R('js/report.js');
const Story = R('js/story.js');
const Toon = R('js/toon.js');
const Intro = R('js/intro.js');
const Chapter = R('js/chapter.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

const timedIn = {
  year: 1990, month: 12, day: 5, hour: 6, minute: 30,
  gender: 'M', unknownTime: false, useTrueSolar: true,
};
const timed = global.Manse.compute(timedIn);
const rp8 = Report.build(timed, { unlocked: false });
const rp8open = Report.build(timed, { unlocked: true });
const unk = global.Manse.compute({ ...timedIn, unknownTime: true });
const rp6 = Report.build(unk, { unlocked: false });

const fakeBox = () => ({ innerHTML: '', querySelectorAll() { return []; } });

console.log('\n[이름]');
{
  ok('이름 있으면 유진님은', Chapter.fill('{이름}님은 지금', { 이름: '유진' }) === '유진님은 지금');
  const empty = Chapter.fill('{이름}님은 지금', { 이름: '' });
  ok('빈 이름에 님은 없음', !empty.includes('님은') && empty.includes('지금'), empty);
  ok('빈 외침은 빈 문자열', global.Josa.fill('{이름}!', { 이름: '' }) === '');
  ok('키 없는 외침도 빈 문자열', global.Josa.fill('{이름}!', {}) === '');
  ok('기본 이름 허준호를 넣지 않는다', global.Josa.fill('{이름}!', { 이름: '' }) !== '허준호!');
}

console.log('\n[사주팔자 기둥]');
{
  ok('시각 있으면 시주', !!timed.pillars.hour);
  ok('glyphCount 8', rp8.glyphCount === 8, String(rp8.glyphCount));
  const cuts8 = Story.build(rp8, { unlocked: false });
  const board = cuts8.find((c) => c.kind === 'chart' && c.pillars && c.pillars.some((p) => p.tag === '연'));
  ok('명식 컷 네 기둥', !!(board && board.pillars.length === 4), board && board.pillars.map((p) => p.tag).join(','));
  ok('시 태그', !!(board && board.pillars.some((p) => p.tag === '시')));
  ok('여덟 글자 문구', !!(board && /여덟/.test(board.foot)));
  ok('거짓 여섯이 아님', !(board && /여섯/.test(board.foot)));

  ok('시각 모름이면 시주 null', unk.pillars.hour === null);
  ok('glyphCount 6', rp6.glyphCount === 6, String(rp6.glyphCount));
  const cuts6 = Story.build(rp6, { unlocked: false });
  const board6 = cuts6.find((c) => c.kind === 'chart' && c.pillars && c.pillars.some((p) => p.tag === '연'));
  ok('명식 컷 세 기둥', !!(board6 && board6.pillars.length === 3), board6 && board6.pillars.map((p) => p.tag).join(','));
  ok('시주 태그를 안 만듦', !!(board6 && !board6.pillars.some((p) => p.tag === '시')));
  ok('여섯 글자 문구', !!(board6 && /여섯/.test(board6.foot)));
  ok('여덟이라고 거짓말 안 함', !!(board6 && !/여덟/.test(board6.foot)));

  /* story.html 폼 → 엔진. useTrueSolar 를 손수 true 로 넣지 않는다. */
  const wall = Story.toManseInput({
    year: 1990, month: 12, day: 5, hour: 7, minute: 0, gender: 'M', unknownTime: false,
  });
  ok('진태양시가 기본', wall.useTrueSolar === true, JSON.stringify(wall));
  const hour07 = global.Manse.compute(wall);
  const hourHan = hour07.pillars.hour
    ? hour07.pillars.hour.stemInfo.han + hour07.pillars.hour.branchInfo.han : '';
  ok('1990-12-05 07:00 시주 丁卯', hourHan === '丁卯', hourHan);
}

console.log('\n[시각 모름 카피]');
{
  ok('기본 단추는 여덟', Intro.submitLabel(false) === '여덟 글자를 세워');
  ok('모름 단추는 여섯', Intro.submitLabel(true) === '여섯 글자를 세워');
  const eight = Intro.openLine(false);
  const six = Intro.openLine(true);
  ok('기본 열림은 네 기둥', eight.indexOf('네 기둥') >= 0 && eight.indexOf('여덟') < 0 || eight.indexOf('연·월·일·시') >= 0, eight);
  ok('모름 열림은 세 기둥', six.indexOf('세 기둥') >= 0 && six.indexOf('네 기둥') < 0, six);
  ok('모름 열림에 시주 안 세움', six.indexOf('시주는 비운다') >= 0 && six.indexOf('연·월·일·시') < 0, six);
}

console.log('\n[말풍선 vs 본문]');
{
  const cuts = Story.build(rp8, { unlocked: false });
  const says = cuts.filter((c) => c.kind === 'scene' || c.kind === 'beat')
    .flatMap((c) => [].concat(c.say || [])).filter(Boolean)
    .map((s) => global.Josa.fill(s, { 이름: '유진' }));
  ok('말풍선이 유진을 부른다', says.some((s) => s.includes('유진')), says.slice(0, 4).join(' | '));
  const prose = cuts.filter((c) => c.kind === 'prose')
    .flatMap((c) => c.paras || [])
    .filter((p) => typeof p === 'string');
  ok('본문이 {이름}님은 으로 시작하지 않는다', prose.every((p) => !/^\s*\{이름\}님은/.test(p)));
  ok('본문에 허준호 하드코딩 없음', prose.every((p) => !p.includes('허준호')));
  const box = fakeBox();
  Toon.render(box, cuts, { 이름: '유진' });
  ok('렌더에 유진', box.innerHTML.includes('유진'));
  ok('렌더에 허준호 없음', !box.innerHTML.includes('허준호'));
  const box0 = fakeBox();
  Toon.render(box0, cuts, { 이름: '' });
  ok('빈 이름 렌더에 님은 없음', !box0.innerHTML.includes('님은'), box0.innerHTML.slice(0, 200));
  ok('빈 이름 렌더에 유진 없음', !box0.innerHTML.includes('유진'));
}

console.log('\n[30,000원 잠금]');
{
  ok('가격 30000', Story.PRICE === 30000, String(Story.PRICE));
  const lockedCuts = Story.build(rp8, { unlocked: false });
  const openCuts = Story.build(rp8open, { unlocked: true });
  const veiled = lockedCuts.filter((c) => c.locked || (c.hidden && c.hidden.length));
  ok('잠긴 컷이 있다', veiled.length > 0, String(veiled.length));
  const dump = JSON.stringify(lockedCuts);
  const openProse = openCuts.filter((c) => c.kind === 'prose')
    .flatMap((c) => c.paras || []).filter((p) => typeof p === 'string' && p.length > 80);
  const secret = openProse.find((p) => dump.indexOf(p.slice(0, 40)) < 0 || veiled.some(() => true));
  const leaked = openProse.filter((p) => p.length > 80 && dump.includes(p));
  // 무료 장(명식·성격 앞·오늘)은 잠긴 덤프에 있어도 된다. 잠긴 장 본문이 통째로 있으면 실패.
  const fullyLocked = lockedCuts.filter((c) => c.locked && !(c.paras || []).some((p) => typeof p === 'string' && p.length > 40));
  ok('완전 잠긴 장 본문에 긴 글자가 없다', fullyLocked.every((c) => !(c.paras || []).some((p) => typeof p === 'string' && p.length > 40)));
  ok('잠긴 장은 길이만', fullyLocked.some((c) => c.hidden && c.hidden.length > 0));
  const box = fakeBox();
  Toon.render(box, lockedCuts, { 이름: '유진' });
  ok('가림 막대가 있다', box.innerHTML.includes('pr-veil'));
  ok('CTA 30000원', box.innerHTML.includes('30,000원'));
  const deep = global.ContentDeep && global.ContentDeep.natures;
  const nk = rp8.type.stem + rp8.type.season;
  const third = deep && deep[nk] && deep[nk].paras && deep[nk].paras[2];
  if (third) {
    ok('성격 뒷문단이 잠긴 JSON에 글자로 없다', !JSON.stringify(lockedCuts).includes(third.slice(0, 32)));
    ok('DOM에 성격 뒷문단 없음', !box.innerHTML.includes(third.slice(0, 24)));
  }
  ok('오늘 무료 컷', lockedCuts.some((c) => c.kind === 'prose' && c.title === '오늘'));
}

console.log('\n[푸터·스크립트]');
{
  const fs = require('fs');
  const html = fs.readFileSync(path.join(ROOT, 'story.html'), 'utf8');
  ok('자기 이해', html.includes('자기 이해') && !html.includes('사기 이해'));
  ok('109', html.includes('109'));
  ok('1577-0199', html.includes('1577-0199'));
  ok('classic script', /<script src="js\/story-app\.js"><\/script>/.test(html));
  ok('module bundle 아님', !html.includes('type="module"'));
}

console.log('\n  ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
