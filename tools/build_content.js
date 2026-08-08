/* ============================================================
   build_content.js — 집필 원문 + 검수 지적을 합쳐 js/content.js 를 만든다.

   왜 스크립트로 하는가:
   글은 모델이 쓰지만, 검수에서 나온 수정은 하나도 빠뜨리면 안 된다.
   PATCHES 를 사유와 함께 적어두면 무엇이 왜 고쳐졌는지 남고,
   패치가 원문에서 안 잡히면 빌드가 실패하니 조용한 누락이 없다.

     node tools/build_content.js

   입력 두 벌:
     content_source.json     1판. 유형 이름 부품(물상·수식)과 챕터 뼈대(id·묶음·무료여부)
     content_source_v2.json  2판. 본문 전부 — 돌려 말하던 화법을 걷어내고 다시 쓴 것
     content_rewrite_v2.json 있으면 2판 위에 덮는다 (템플릿으로 읽히던 문장 재작성)
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC1 = path.join(__dirname, 'content_source.json');
const SRC2 = path.join(__dirname, 'content_source_v2.json');
const SRC3 = path.join(__dirname, 'content_source_flow.json');  // 3판. 이번 달·올해 축
const VOICE = path.join(__dirname, 'voice_modern.json');        // 4판. 도령체 → 현대 상담체
const REWRITE = path.join(__dirname, 'content_rewrite_v2.json');
const OUT = path.join(ROOT, 'js', 'content.js');

const HAN2KOR = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
                  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };

/* ── 검수 수정 ────────────────────────────────────────────
   [경로, 찾을것(null = 통째 교체), 바꿀것, 사유, optional?]
   사유의 (안전)은 안전검수, (화법)은 "한 번에 이해되는가" 검수에서 나왔다. */
const PATCHES = [
  /* ═══ 1판에서 이어지는 것 — 유형 이름 부품 ═══ */
  ['modifiers.진.modifier', null, '비 잦은', '화법: "물기 머금은 무쇠"가 녹슨 쇠로 읽힌다'],
  ['modifiers.진.gloss', null, '비가 자주 들어 품고 기르는 무렵', '화법: 수식구 되풀이'],
  ['modifiers.미.modifier', null, '볕 익는', '화법: "무르익은 이슬"이 어색하다'],
  ['modifiers.묘.modifier', null, '꽃 피는', '화법: "초록 오르는 무쇠"가 녹으로 읽힌다'],
  ['modifiers.묘.gloss', null, '일제히 피어 생기가 도는 결', '화법: 수식구 정합'],
  ['modifiers.축.gloss', null, '언 흙 아래에서 다음 철을 기다리는 품', '화법: 수식구 되풀이'],
  ['modifiers.오.gloss', null, '불기운이 가장 센 때, 거침없이 뻗는 힘', '화법: 온도 모순'],
  ['modifiers.인.gloss', null, '얼었던 것이 조심스레 풀리는 무렵', '화법: "결" 어미 편중'],
  ['modifiers.신.gloss', null, '서늘한 기운이 들어 매듭이 지어지는 때', '화법: "결" 어미 편중'],
  ['modifiers.자.gloss', null, '밤이 가장 길어 고요히 모으는 무렵', '화법: "결" 어미 편중'],
  ['modifiers.술.gloss', null, '거두어들여 안으로 챙겨 두는 무렵', '화법: "여미다"·"갈무리"가 뜻이 한 번에 안 잡힌다'],
  ['nouns.갑.gloss', null, '곧게 자라 남의 그늘이 되어주는 품', '화법: "결" 어미 편중'],
  ['nouns.경.gloss', null, '끊을 것은 끊고 길을 내는 손', '화법: "결" 어미 편중'],
  ['nouns.임.gloss', null, '깊고 넓게 흘러 다 받아내는 그릇', '화법: "결" 어미 편중'],

  /* ═══ 오늘의 운 · 안전 ═══ */
  ['todayRelations.편재.work', null,
    '새 제안이나 소개가 들어오기 쉽네. 마음이 들뜬 날일수록 조건이 눈에 덜 들어오니, 들은 내용을 그대로 적어만 두시게.',
    '안전: "도장은 미루시게"는 운세를 근거로 계약 시점을 지시하는 말이라 법률·금융 자문이 된다'],
  ['todayRelations.편재.avoid', null,
    '오늘은 마음이 여러 갈래로 흩어지기 쉬운 날일세. 무엇에 마음이 급해졌는지 한 번 들여다보시게.',
    '안전: "큰돈 걸린 결정을 그 자리에서 내리지 마시게"는 자금 판단에 개입하는 형태다'],
  ['todayRelations.겁재.avoid', null,
    '오늘은 지고 싶지 않은 마음이 말보다 앞서기 쉽네. 급히 답을 주기 전에 한 박자만 쉬어 가시게.',
    '안전: 빚의 시점을 말리는 문장은 금융 자문이다. 급전이 필요한 사람의 결정을 미루게 만든다'],
  ['todayBranches.사.bestWhy', null, '머리가 가장 맑은 때라 꼼꼼히 따져야 할 일을 보기 좋다네.',
    '안전: 특정 시간을 "계약 보기 좋은 때"로 지목하면 택일식 권고가 된다'],
  ['todayRelations.정관.people', null,
    '오늘은 자네가 어디까지 왔는지 남들이 궁금해하기 쉬운 날일세. 묻기 전에 진행 상황을 먼저 알리시게.',
    '안전: "윗사람이 눈여겨보네"는 계산으로 알 수 없는 제3자의 속마음을 단정한다'],
  ['todayRelations.비견.people', null,
    '오늘은 남의 고민이 남 일 같지 않게 들리기 쉽네. 조언을 얹기보다 "나도 그랬네" 한마디가 낫지.',
    '안전: "친구가 고민을 들고 오네"는 제3자의 행동을 일어날 일로 단정한다'],

  /* ═══ 오늘의 운 · 화법 ═══ */
  ['todayRelations.편재.headline', null, '여기저기서 기회가 들어오는 날',
    '화법: "기회가 흩어지는 날"은 기회가 날아간다는 뜻으로 먼저 읽혀 본문과 반대가 된다'],
  ['todayRelations.정인.headline', null, '오늘은 남에게 기대어 쉬어도 되는 날일세',
    '화법: "기대도 괜찮은 날"의 "기대"가 기대다/기대(expectation) 두 갈래로 읽힌다'],
  ['todayRelations.정관.work', null,
    '보고와 결재, 서류 정리가 잘 되네. 절차를 건너뛰면 나중에 처음부터 다시 하게 되지.',
    '화법: "질러가면 되돌아오지"는 무엇이 되돌아오는지 모호하다'],

  /* ═══ 지지 관계 · 화법 ═══ */
  // 다섯 줄 모두 "자네 자리"라 쓰는데, 일지를 뜻하는 말이라 일반 독자는 직장인지 위치인지 모른다
  // 조사까지 함께 바꾼다. "기운" 은 받침이 있어 '와' 가 아니라 '과' 를 받는다.
  ['branchKinds.충.line', '자네 자리와', '자네가 태어난 날의 기운과', '화법: "자네 자리"를 한 번도 안 푼다'],
  ['branchKinds.육합.line', '자네 자리와', '자네가 태어난 날의 기운과', '화법: 같음'],
  ['branchKinds.삼합.line', '자네 자리와', '자네가 태어난 날의 기운과', '화법: 같음'],
  ['branchKinds.보통.line', '자네 자리와', '자네가 태어난 날의 기운과', '화법: 같음'],
  ['branchKinds.같음.line', null,
    '오늘 기운이 자네가 태어난 날의 글자와 똑같이 겹치네. 자네 색이 그만큼 진해져 평소 습관이 두 배로 나오기 쉽지.',
    '화법: "내 색이 진해지니"에서 인칭이 자네→나로 튀고 비유가 안 풀린다'],

  /* ═══ 기질 풀이 · 화법 ═══ */
  ['defs.갑여름.body', null,
    '여름 나무는 잎을 잔뜩 내느라 제 물을 다 쓰네. 쉽게 말해 주변을 챙기는 데 기운을 몰아 쓴다는 뜻이지. 가진 걸 밖으로 꺼내 쓰는 기운이 센 자리라(식신) 남 앞에 나설 일이 자꾸 생기네. 그래서 정작 자네 일이 뒤로 밀리지.',
    '화법: (식신)을 풀이 없이 던졌고 오행 설명이 독자에게 그냥 넘어간다'],
  ['defs.무가을.body', null,
    '가을 산은 품고 있던 걸 밖으로 내놓네. 그러니까 자기 것을 조용히 나눠주는 사람이라는 뜻일세. 가진 걸 꺼내 쓰는 기운이 도는 철이라(식상) 남 몫까지 챙기게 되지. 생색은 잘 안 내네.',
    '화법: 오행 용어를 오행 용어로 설명했다'],
  ['defs.병가을.body', null,
    '가을볕은 여름볕만큼 뜨겁진 않아도 구석까지 고루 닿네. 그러니까 감정을 확 쏟지는 않아도 챙길 사람은 빠짐없이 챙긴다는 뜻일세. 불기운이 한풀 꺾이는 철이라 나서기 전에 한 번 재보지. 밝은데 시끄럽지 않은 사람으로 보이네.',
    '화법: 비유와 풀이가 안 이어져 다시 올라가 읽게 된다'],
  ['defs.갑가을.caution', null, '따져보는 사이에 기회가 지나가도, 아쉽지 않은 척을 하네.',
    '화법: "재는 사이에"가 재(灰)로 먼저 읽힌다'],

  /* ═══ 지지·챕터 ═══ */
  ['todayBranches.축.bestWhy', null, '오전에 올려놓은 기운이 오후까지 가장 오래 가는 때라네.',
    '화법: "오전에 데운 힘"이 비유인데 안 풀렸다'],
  ['chapters.daewoon-overview.title', null, '열 해마다 바뀌는 자네 삶의 [ 여덟 마디 ]',
    '화법: 제목은 "열두 마디"인데 티저는 여덟 마디라 숫자가 안 맞는다'],

  // 이번 달·올해 축의 수정 31건은 따로 모아 뒀다
  ...require('./patches_flow.js'),
];

/* ── 대운 전환 문구 (1판에서 그대로 가져온다) ── */
const TRANSITIONS = [
  { from: '비겁', to: '식상', line: '안으로 쌓던 힘이 밖으로 터지네. 말이 앞서다 발을 헛디디기 쉽지.' },
  { from: '식상', to: '재성', line: '만들던 것이 값으로 바뀌네. 재미로 하던 일이 셈이 되어 시들해지기도 하지.' },
  { from: '재성', to: '관성', line: '쥔 것을 지킬 자리가 필요해지네. 자유가 줄어 답답하기 쉽지.' },
  { from: '관성', to: '인성', line: '짐을 내려놓고 안으로 돌아서네. 한동안 뒤처진 듯 허전하지.' },
  { from: '인성', to: '비겁', line: '품에서 나와 제 발로 서네. 기대던 데가 없어져 잠시 휘청이지.' },
];

/* ══════════════ 조립 ══════════════ */

function get(db, dotted) {
  const [bucket, key, field] = dotted.split('.');
  const b = db[bucket];
  if (!b) throw new Error(`없는 묶음: ${bucket}`);
  const row = b[key];
  if (!row) throw new Error(`없는 항목: ${bucket}.${key}`);
  return [row, field];
}

/* 말투 판(voice_modern.json)은 db 와 키 모양이 조금 다르다.
   defs.경가을.body 처럼 깊이가 3인 것도, chapters 처럼 배열인 것도 있어
   경로를 일반적으로 훑는다. 배열은 id 로 찾는다. */
function resolveVoice(v, dotted) {
  const parts = dotted.split('.');
  let cur = v;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    cur = Array.isArray(cur) ? cur.find((x) => x && x.id === k) : (cur && cur[k]);
    if (!cur) return null;
  }
  return [cur, parts[parts.length - 1]];
}

function applyVoicePatches(v) {
  const patches = require('./patches_voice.js');
  const bad = [];
  for (const [dotted, find, repl, why] of patches) {
    const hit = resolveVoice(v, dotted);
    if (!hit) { bad.push(`${dotted} — 경로를 못 찾음`); continue; }
    const [row, field] = hit;
    const cur = row[field];
    if (typeof cur !== 'string') { bad.push(`${dotted} — 글이 아니다`); continue; }
    if (find === null) { row[field] = repl; continue; }
    if (!cur.includes(find)) { bad.push(`${dotted} — 못 찾음: "${find}"`); continue; }
    row[field] = cur.split(find).join(repl);
  }
  if (bad.length) {
    console.error('\n말투 수정 실패:');
    bad.forEach((b) => console.error('  ×', b));
    process.exit(1);
  }
  console.log(`  말투 검수 수정 ${patches.length}건 적용`);
}

function main() {
  const v1 = JSON.parse(fs.readFileSync(SRC1, 'utf8'));
  const v2 = JSON.parse(fs.readFileSync(SRC2, 'utf8'));
  const v3 = JSON.parse(fs.readFileSync(SRC3, 'utf8'));

  const db = {
    nouns: {}, modifiers: {}, defs: {}, chapters: {}, daeunPhases: {},
    todayRelations: {}, todayBranches: {}, branchKinds: {},
    monthMeets: {}, yearLines: {},
  };

  /* 이번 달 × 오늘 기운, 그리고 올해.
     하루가 일진 하나로만 정해지면 60일마다 똑같이 돌아온다 — 두 달이면 들킨다.
     이 두 축을 얹어야 한 해를 넘긴다. (tools/measure_repeat.js 로 잴 수 있다) */
  v3.months.forEach((m) => {
    db.monthMeets[m.group] = {};
    m.lines.forEach((l) => { db.monthMeets[m.group][l.branch] = l.line; });
  });
  v3.years.forEach((y) => { db.yearLines[y.relation] = { label: y.label, line: y.line }; });

  // 유형 이름 부품은 1판 그대로 — 여기는 지적이 없었다
  v1.names.nouns.forEach((n) => { db.nouns[n.stem] = { noun: n.noun, gloss: n.gloss }; });
  v1.names.modifiers.forEach((m) => { db.modifiers[m.branch] = { modifier: m.modifier, gloss: m.gloss }; });

  // 본문은 전부 2판
  v2.defs.entries.forEach((e) => {
    db.defs[e.stem + e.season] = {
      headline: e.headline, body: e.body, example: e.example,
      strength: e.strength, caution: e.caution,
    };
  });
  v2.daeun.phases.forEach((p) => {
    db.daeunPhases[p.key] = { label: p.label, line: p.line, example: p.example, advice: p.advice };
  });
  v2.today.relations.forEach((r) => {
    db.todayRelations[r.relation] = {
      mood: r.mood, headline: r.headline, why: r.why,
      work: r.work, people: r.people, body: r.body,
      doThis: r.doThis, avoid: r.avoid, watchFor: r.watchFor, goodWith: r.goodWith,
    };
  });
  v2.branches.branches.forEach((b) => {
    const kor = HAN2KOR[b.branch] || b.branch;   // 한자로 오면 한글로 맞춘다
    db.todayBranches[kor] = { air: b.air, bestTime: b.bestTime, bestWhy: b.bestWhy };
  });
  v2.clash.kinds.forEach((k) => {
    db.branchKinds[k.kind] = { label: k.label, line: k.line, tip: k.tip };
  });

  // 챕터는 뼈대(묶음·무료여부·근거)를 1판에서, 문장을 2판에서 가져온다
  const t2 = Object.fromEntries(v2.chapters.chapters.map((c) => [c.id, c]));
  v1.chapters.chapters.forEach((c) => {
    const n = t2[c.id];
    if (!n) throw new Error(`2판에 없는 챕터: ${c.id}`);
    db.chapters[c.id] = { id: c.id, group: c.group, free: !!c.free, basis: c.basis, title: n.title, teaser: n.teaser };
  });

  /* ── 템플릿으로 읽히던 문장 재작성 ── */
  let rewrites = 0;
  if (fs.existsSync(REWRITE)) {
    const rw = JSON.parse(fs.readFileSync(REWRITE, 'utf8'));
    (rw.why || []).forEach((e) => {
      if (!db.todayRelations[e.relation]) { console.warn(`  ! 없는 십성: ${e.relation}`); return; }
      db.todayRelations[e.relation].why = e.why; rewrites++;
    });
    (rw.defExamples || []).forEach((e) => {
      const k = e.stem + e.season;
      if (!db.defs[k]) { console.warn(`  ! 없는 기질: ${k}`); return; }
      db.defs[k].example = e.example; rewrites++;
    });
    (rw.daeunExamples || []).forEach((e) => {
      if (!db.daeunPhases[e.key]) { console.warn(`  ! 없는 대운: ${e.key}`); return; }
      db.daeunPhases[e.key].example = e.example; rewrites++;
    });
  }

  /* ── 검수 수정 ── */
  const failed = [], skipped = [];
  for (const [dotted, find, repl, why, optional] of PATCHES) {
    let row, field;
    try { [row, field] = get(db, dotted); } catch (e) { failed.push(`${dotted} — ${e.message}`); continue; }
    const cur = row[field];
    if (cur == null) { failed.push(`${dotted} — 그런 칸이 없다`); continue; }
    if (find === null) { row[field] = repl; continue; }
    if (!String(cur).includes(find)) {
      // optional 은 다시쓰기가 이미 같은 자리를 손봤을 때를 위한 것이다
      if (!optional) failed.push(`${dotted} — 못 찾음: "${find}"`);
      else skipped.push(dotted);
      continue;
    }
    const hits = String(cur).split(find).length - 1;
    if (hits > 1) console.warn(`  ! ${dotted} — "${find}" 가 ${hits}군데 있어 모두 바꿨다`);
    row[field] = String(cur).split(find).join(repl);
  }

  /* 말투는 검수 수정을 다 적용한 뒤에 덮는다.
     voice_modern.json 은 이미 패치가 반영된 content.js 에서 뽑아 옮긴 것이라,
     먼저 덮으면 뒤따르는 PATCHES 가 옛 도령체 문장으로 되돌려 놓는다. */
  /* ── 말투를 현대어로 갈아끼운다 ─────────────────────────
     1~3판은 전부 조선 도령 말투("자네", "~하네", "~하시게")로 쓰였다.
     사용자가 두 번 지적했다 — 돌려 말해서 뜻이 한 번에 안 잡히고, 그래서 읽다가 나간다.
     내용·근거·구조는 그대로 두고 말투만 옮긴 판을 여기서 덮는다.
     원문을 지우지 않고 덮는 이유는, 무엇이 어떻게 바뀌었는지 대조할 수 있어야 하기 때문이다. */
  let voiced = 0;
  if (fs.existsSync(VOICE)) {
    const v = JSON.parse(fs.readFileSync(VOICE, 'utf8'));
    applyVoicePatches(v);           // 말투 검수에서 나온 27건은 덮기 전에 반영한다
    const put = (bucket, src) => {
      if (!src) return;
      for (const [k, row] of Object.entries(src)) {
        if (!db[bucket] || !db[bucket][k]) { console.warn(`  ! 말투: 없는 항목 ${bucket}.${k}`); continue; }
        for (const [f, val] of Object.entries(row)) {
          if (typeof val === 'string') { db[bucket][k][f] = val; voiced++; }
        }
      }
    };
    put('todayRelations', v.today);
    put('todayBranches', v.branches);
    put('branchKinds', v.kinds);
    put('defs', v.defs);
    put('daeunPhases', v.daeun && v.daeun.phases);
    put('yearLines', v.year);
    put('nouns', v.names && v.names.nouns);
    put('modifiers', v.names && v.names.modifiers);
    // 이번 달 줄은 {그룹: {지지: 문장}} 이라 한 겹 더 들어간다
    if (v.month) {
      for (const [g, m] of Object.entries(v.month)) {
        for (const [b, line] of Object.entries(m)) {
          if (db.monthMeets[g] && typeof line === 'string') { db.monthMeets[g][b] = line; voiced++; }
        }
      }
    }
    if (Array.isArray(v.daeun && v.daeun.transitions)) {
      v.daeun.transitions.forEach((t, i) => {
        if (TRANSITIONS[i] && t.line) { TRANSITIONS[i].line = t.line; voiced++; }
      });
    }
    // 챕터는 id 로 맞춰 제목·티저·근거만 갈아끼운다. 무료 여부와 묶음은 건드리지 않는다.
    if (Array.isArray(v.chapters)) {
      v.chapters.forEach((c) => {
        const t = db.chapters[c.id];
        if (!t) { console.warn(`  ! 말투: 없는 챕터 ${c.id}`); return; }
        ['title', 'teaser', 'basis'].forEach((f) => {
          if (typeof c[f] === 'string') { t[f] = c[f]; voiced++; }
        });
      });
    }
  }


  /* ── 검산 ── */
  const problems = [...failed];
  const need = {
    nouns: 10, modifiers: 12, defs: 40, chapters: 12,
    daeunPhases: 10, todayRelations: 10, todayBranches: 12, branchKinds: 5,
    monthMeets: 5, yearLines: 10,
  };
  for (const [k, n] of Object.entries(need)) {
    const got = Object.keys(db[k]).length;
    if (got !== n) problems.push(`${k}: ${got}개 (${n}개여야 한다)`);
  }
  if (Object.values(db.chapters).filter((c) => c.free).length !== 4) {
    problems.push('무료 챕터가 4개가 아니다');
  }
  // 오늘의 운은 칸이 하나라도 비면 화면이 휑해진다
  for (const [k, r] of Object.entries(db.todayRelations)) {
    for (const f of ['mood', 'headline', 'why', 'work', 'people', 'body', 'doThis', 'avoid', 'watchFor', 'goodWith']) {
      if (!r[f]) problems.push(`todayRelations.${k}.${f} 가 비었다`);
    }
  }

  // 이번 달 줄은 5묶음 × 12달 = 60개가 다 있어야 한다
  const BR12 = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  for (const [g, m] of Object.entries(db.monthMeets)) {
    for (const b of BR12) if (!m[b]) problems.push(`monthMeets.${g}.${b} 가 없다`);
  }
  // 이 축을 더한 이유가 "같은 하루가 60일마다 돌아오는 것"을 깨는 데 있으니,
  // 60줄 안에 똑같은 문장이 생기면 그 순간 이 작업은 뜻을 잃는다. 빌드를 세운다.
  const seenLine = new Map();
  for (const [g, m] of Object.entries(db.monthMeets)) {
    for (const [b, line] of Object.entries(m)) {
      if (seenLine.has(line)) problems.push(`monthMeets 문장 중복: ${g}.${b} = ${seenLine.get(line)}`);
      else seenLine.set(line, `${g}.${b}`);
    }
  }
  for (const [k, y] of Object.entries(db.yearLines)) {
    if (!y.label || !y.line) problems.push(`yearLines.${k} 가 비었다`);
  }

  // 단정 금지어와, "한 번에 안 잡히는 옛말"이 다시 섞여 들어오면 여기서 잡는다
  const BANNED = ['반드시', '틀림없이', '어김없이', '무조건', '확실히'];
  const ARCHAIC = ['속엣말', '눅다', '눅네', '성기던', '오롯이', '헛헛', '여미', '갈무리', '물꼬', '서슬'];
  const hits = [];
  (function walk(o, p) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') {
        BANNED.forEach((b) => { if (v.includes(b)) problems.push(`단정 금지어 "${b}" — ${p}.${k}`); });
        ARCHAIC.forEach((a) => { if (v.includes(a)) hits.push(`${p}.${k} : ${a}`); });
      } else if (v && typeof v === 'object') walk(v, `${p}.${k}`);
    }
  })(db, '');

  if (problems.length) {
    console.error('\n빌드 실패:');
    problems.forEach((p) => console.error('  ×', p));
    process.exit(1);
  }

  db.daeunTransitions = TRANSITIONS;
  // 챕터는 id 로 키를 잡아야 패치하기 좋지만 화면에서는 차례가 있어야 한다.
  // 무료와 잠김이 섞인 순서 그대로 내보낸다 — 그 엇갈림이 목차를 궁금하게 만든다.
  db.chapters = Object.values(db.chapters);

  const head = `/* ============================================================
   content.js — 온도령이 하는 말.  ※ 손으로 고치지 마시오.

   tools/build_content.js 가 만든다. 고칠 것이 있으면 그 스크립트의
   PATCHES 에 사유와 함께 적고 다시 돌린다 — 무엇이 왜 바뀌었는지 남는다.

     node tools/build_content.js

   담긴 것
     nouns(10)·modifiers(12)  유형 이름 부품 → 120가지 조합
     defs(40)                 일간 10 × 계절 4 기질 풀이 (+ 구체적 예시)
     chapters(12)             리포트 목차 (무료 4 / 잠김 8)
     daeunPhases(10)          십성 5그룹 × 왕약 2
     daeunTransitions(5)      국면이 갈리는 길목
     todayRelations(10)       오늘 일진 십성별 하루 — 이 앱의 재방문 장치
     todayBranches(12)        그날 지지의 공기와 잘 풀리는 시간대
     branchKinds(5)           오늘 지지 × 내 일지 (충·육합·삼합·같음·보통)
   ============================================================ */
const Content = `;

  fs.writeFileSync(OUT, head + JSON.stringify(db, null, 2) +
    ';\n\nif (typeof module !== \'undefined\') module.exports = Content;\n', 'utf8');

  const applied = PATCHES.length - skipped.length;
  console.log(`content.js 완성 — ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB`);
  console.log(`  검수 수정 ${applied}건${rewrites ? `, 재작성 ${rewrites}건` : ''}`);
  if (skipped.length) console.log(`  재작성이 이미 처리해 건너뜀: ${skipped.join(', ')}`);
  if (hits.length) {
    console.log(`  ※ 뜻이 한 번에 안 잡히는 낱말이 ${hits.length}군데 남았다:`);
    hits.slice(0, 8).forEach((h) => console.log(`     ${h}`));
  }

  // 오늘의 운이 얼마나 두꺼워졌는지 — 이 숫자가 곧 재방문 이유의 크기다
  const lens = Object.values(db.todayRelations).map((r) =>
    ['headline', 'why', 'work', 'people', 'body', 'doThis', 'avoid', 'watchFor', 'goodWith']
      .reduce((a, f) => a + (r[f] || '').length, 0));
  console.log(`  오늘의 운 평균 ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}자 ` +
              `(가장 짧은 것 ${Math.min(...lens)}자)`);
}

main();
