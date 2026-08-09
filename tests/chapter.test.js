/* chapter.js — 긴 글이 화면에 제대로 그려지는지.
   특히 두 가지가 중요하다.
     · 잠긴 문단의 진짜 글자가 결과 HTML 에 절대 안 들어가야 한다
     · 이름을 안 적은 사람에게 "님은 지금" 같은 부스러기가 안 남아야 한다 */
'use strict';
global.Josa = require('../js/josa.js');
const C = require('../js/chapter.js');

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; return; }
  fail++; console.log('  ✗ ' + name + (extra ? '\n      ' + extra : ''));
};

const CH = {
  title: '{물상}의 시간이 시작될 때',
  lead: '한 문장 요약이에요.',
  paras: [
    '{이름}님은 지금 **{대운간지} 대운**을 지나고 있어요. {물상}이 제 자리를 찾는 때예요.',
    '두 번째 문단이에요. 여기까지는 무료로 보여요.',
    '세 번째 문단은 잠겨야 해요. 절대공개금지문장.',
    '네 번째 문단도 잠겨야 해요. 이것도비밀입니다.',
  ],
  cutAt: 2,
};
const V = { 이름: '유진', 물상: '바다', 대운간지: '경술(庚戌)' };

/* ── 잠금 ── */
const locked = C.render(CH, { open: false, values: V });
ok(!locked.includes('절대공개금지문장'), '잠긴 3문단의 글자가 HTML 에 없다');
ok(!locked.includes('이것도비밀입니다'), '잠긴 4문단의 글자가 HTML 에 없다');
ok(locked.includes('두 번째 문단이에요'), '무료 2문단은 보인다');
ok((locked.match(/cp-veil/g) || []).length === 2, '가린 문단이 정확히 2개', locked.match(/cp-veil/g));
ok(locked.includes('2문단이 더 있어요'), '남은 문단 수를 알려준다');

const open = C.render(CH, { open: true, values: V });
ok(open.includes('절대공개금지문장'), '열리면 전부 보인다');
ok(!open.includes('cp-veil'), '열리면 가린 자리가 없다');
ok(!open.includes('더 있어요'), '열리면 남은 문단 안내가 없다');

/* ── 조사 ── */
ok(locked.includes('바다의 시간이'), '제목 슬롯이 채워진다');
ok(locked.includes('바다가 제 자리를'), '"바다이" 가 아니라 "바다가"', locked.slice(locked.indexOf('바다') - 10, locked.indexOf('바다') + 40));
ok(locked.includes('경술(庚戌) 대운'), '간지 슬롯이 채워진다');

/* ── 이름이 없을 때 ── */
const noName = C.render(CH, { open: true, values: { 물상: '무쇠', 대운간지: '경술(庚戌)' } });
ok(!noName.includes('님은'), '이름이 없으면 "님은" 부스러기가 안 남는다',
  noName.slice(noName.indexOf('cp-body'), noName.indexOf('cp-body') + 90));
ok(noName.includes('지금 <b>경술(庚戌) 대운</b>'), '이름을 지워도 문장이 성립한다');
ok(noName.includes('무쇠가 제 자리를'), '"무쇠이" 가 아니라 "무쇠가"');

/* ── 굵게 ── */
ok(locked.includes('<b>경술(庚戌) 대운</b>'), '**굵게** 가 <b> 로 바뀐다');
ok(!locked.includes('**'), '별표가 남지 않는다');

/* ── 이스케이프 ── */
const evil = C.render({ title: '<script>x</script>', paras: ['<img onerror=1>'], cutAt: 1 }, { open: true });
ok(!evil.includes('<script>'), '원고에 든 태그는 살아나지 않는다');
ok(evil.includes('&lt;script&gt;'), '태그가 글자로 바뀐다');

/* ── 행동 줄 ── */
const act = C.render(CH, { open: false, values: V, act: { doThis: '5분만 열어보세요', avoid: '급히답하기' } });
ok(act.includes('5분만 열어보세요'), '해볼 것은 무료로 보인다');
ok(!act.includes('급히답하기'), '미뤄둘 것은 잠긴다');

/* ── 무너지지 않는지 ── */
ok(C.render(null) === '', '빈 값이면 빈 문자열');
ok(C.render({ paras: [] }, { open: true }).includes('cp'), '문단이 없어도 안 터진다');
ok(!C.render({ paras: ['하나'], cutAt: 5 }, { open: false }).includes('cp-veil'),
  'cutAt 이 문단 수보다 크면 다 보여준다');

/* ── 유료분을 따로 뺀 판 ──────────────────────────────
   무료 파일에는 잠긴 문단의 **글자가 아예 없다.** 길이(hidden)만 있다.
   그래서 개발자도구로도 못 읽는다.
   구독하면 content-paid.js 가 따로 내려와 opts.paid 로 들어온다. */
const SPLIT = {
  title: '나눈 판',
  paras: ['무료 첫 문단이에요.', '무료 둘째 문단이에요.'],
  hidden: [42, 55, 30],          // 잠긴 문단 셋의 길이만
  cutAt: 2,
};
const PAID = ['잠긴셋째절대노출금지', '잠긴넷째절대노출금지', '잠긴다섯째절대노출금지'];

const lockedSplit = C.render(SPLIT, { open: false });
ok(!lockedSplit.includes('잠긴'), '나눈 판 — 잠긴 글자가 HTML 에 없다');
ok((lockedSplit.match(/cp-veil/g) || []).length === 3, '나눈 판 — 가린 문단이 3개',
  (lockedSplit.match(/cp-veil/g) || []).length);
ok(lockedSplit.includes('3문단이 더 있어요'), '나눈 판 — 남은 문단 수를 센다');
ok(lockedSplit.includes('무료 둘째 문단'), '나눈 판 — 무료 문단은 보인다');

const openSplit = C.render(SPLIT, { open: true, paid: PAID });
ok(openSplit.includes('잠긴셋째절대노출금지'), '유료분을 받으면 열린다');
ok(!openSplit.includes('cp-veil'), '열리면 가린 자리가 없다');
ok(!openSplit.includes('더 있어요'), '열리면 남은 문단 안내가 없다');

// 구독은 했는데 유료 파일을 못 받은 경우 — 화면이 비면 안 된다
const noPaid = C.render(SPLIT, { open: true, paid: [] });
ok(noPaid.includes('무료 둘째 문단'), '유료 파일을 못 받아도 무료분은 나온다');
ok(noPaid.includes('cp-veil'), '유료 파일을 못 받으면 그 자리는 막대로 남는다');

console.log('  나눈 판까지 ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
