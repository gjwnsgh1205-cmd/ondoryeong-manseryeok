/* ============================================================
   story.js — 명식 하나를 웹툰 컷 목록으로 엮는다.

   여기가 그릇이다. **지금은 미리 써둔 글 129편으로 채우고,
   서버가 붙으면 같은 자리를 Sonnet 이 덮어쓴다.** 그릇이 같으니 갈아끼우기만 하면 된다.

   장은 여덟이다. 장마다 scene 컷 하나로 열고, prose 가 이어지고,
   다음 장 앞에 beat 가 낀다 — 어둠·빛·어둠·빛.

   이름을 부르는 건 **언제나 말풍선(scene/beat)** 이다. 본문은 부르지 않는다.
   한 편에 열여덟 번쯤 불린다. 읽다가 잊을 만하면 이름이 온다.
   ============================================================ */
const Story = (() => {
  'use strict';

  const C = () => (typeof Content !== 'undefined' ? Content
    : (typeof window !== 'undefined' ? window.Content : null));

  /* 깊은 글. 있으면 이걸 먼저 쓴다.
     129편은 한 사람이 8천 자를 보는 분량이고, 이 팩은 같은 자리를 훨씬 길게 덮는다.
     축(일간·계절, 십성 열쇠)에 걸리는 것이라 같은 열쇠를 가진 사람이면 누구나 본다.
     안 걸리면 조용히 129편으로 돌아간다 — 화면이 비지 않는다. */
  const D = () => (typeof ContentDeep !== 'undefined' ? ContentDeep
    : (typeof window !== 'undefined' ? window.ContentDeep : null));

  const lf = (box, key) => {
    if (!key) return null;
    const deep = D();
    if (deep && deep[box] && deep[box][key]) return deep[box][key];
    const db = C();
    return (db && db.longform && db.longform[box]) ? db.longform[box][key] : null;
  };

  /* 이 명식에만 걸리는 글(권두·대운 열 줄·발문).
     대운은 태어난 때마다 달라서 축으로 묶을 수가 없다. 여덟 글자를 이어 열쇠로 쓴다. */
  function chartOnly(chart, key) {
    const deep = D();
    if (!deep || !deep.charts) return null;
    const P = chart.pillars;
    const sig = ['year', 'month', 'day', 'hour']
      .filter((k) => P[k])
      .map((k) => P[k].stemInfo.kor + P[k].branchInfo.kor).join('');
    const box = deep.charts[sig];
    return (box && box[key]) || null;
  }

  /* 잠긴 문단까지 합쳐 한 장을 통째로 돌려준다.
     웹툰에서는 중간에 막대를 세우지 않는다 — 읽는 흐름이 끊기면 웹툰이 아니다.
     값을 받는 자리는 따로 정한다(뒤쪽 장을 통째로 잠그는 식). */
  function whole(ch, paid) {
    if (!ch) return null;
    const rest = (paid && paid.length) ? paid : [];
    return { title: ch.title, lead: ch.lead, paras: (ch.paras || []).concat(rest) };
  }

  const pillarCols = (chart) => {
    const P = chart.pillars;
    const tag = { year: '연', month: '월', day: '일', hour: '시' };
    return ['year', 'month', 'day', 'hour'].filter((k) => P[k]).map((k) => ({
      top: P[k].stemInfo.han, bot: P[k].branchInfo.han, tag: tag[k],
    }));
  };

  /* 여덟 장. 순서와 앵커와 여는 대사, 그리고 **바탕색**이 여기 한 곳에 모여 있다.
     mood 는 장마다 배경이 띠는 색이다. 장이 바뀌면 뒤에 흐르는 부적의 색이 서서히 갈린다.
     같은 화면을 여덟 번 보는 게 아니라 여덟 방을 지나가는 느낌을 만드는 장치다.

     마지막 장만 light:1 이다. 어두운 데서 시작해 **흰 데로 걸어 나오며 끝난다.** */
  const PLAN = [
    { key: 'chart',  anchor: 'unfold', mood: [120, 130, 210], say: ['{이름}!', '이게 네 여덟 글자다. 연·월·일·시.'] },
    { key: 'nature', anchor: 'point',  mood: [ 90, 190, 170], say: ['{이름}.', '태어난 날의 글자, 그게 너다.'] },
    { key: 'inout',  anchor: 'greet',  mood: [160, 120, 220], say: ['밖에서 읽는 너랑 안에 있는 너가 달라.', '둘 다 너다.'] },
    { key: 'people', anchor: 'laugh',  mood: [240, 150,  90], say: ['{이름}.', '누구 옆에서 숨이 트이지.'] },
    { key: 'money',  anchor: 'grave',  mood: [220, 180,  90], say: ['돈은 재성이다. 감정 빼고 보자.'] },
    { key: 'flow',   anchor: 'far',    mood: [220,  80,  70], say: ['십 년마다 바람이 갈린다.', '{이름}, 지금 그 한가운데다.'] },
    { key: 'year',   anchor: 'amused', mood: [255, 190, 110], say: ['올해 세운이다. {이름}, 이 해만 따로 보자.'] },
    { key: 'end',    anchor: 'close',  mood: [200, 195, 185], light: 1, say: ['여기까지다.', '나머지는 {이름}이 산다.'] },
  ];

  /* 장 사이에 끼는 한 줄. 검은 화면에 이것만 뜬다. */
  const BEATS = [
    '{이름}. 정신 차려. 이제 하나씩이다.',
    '아직 반도 안 왔다.',
    '{이름}. 이건 좀 맞을 거다.',
    '여기서부터는 잘 들어.',
    '{이름}!',
    '거의 다 왔다.',
    '마지막이다. {이름}.',
  ];

  /** 장 하나를 prose 컷 목록으로. 600~900자 덩이로 끊는다. */
  function proseCuts(chapters) {
    const out = [];
    for (const ch of chapters) {
      if (!ch) continue;
      const paras = ch.paras || [];
      let buf = [], len = 0, first = true;
      const flush = () => {
        if (!buf.length) return;
        out.push({ kind: 'prose', title: first ? ch.title : '', lead: first ? ch.lead : '', paras: buf });
        buf = []; len = 0; first = false;
      };
      for (const p of paras) {
        buf.push(p); len += p.length;
        if (len >= 700) flush();       // 벽처럼 쌓이면 안 읽힌다
      }
      flush();
    }
    return out;
  }

  /** 명식 하나 → 컷 배열 */
  function build(rp, opts = {}) {
    const paid = opts.paid || {};
    const pf = (box, key) => (paid[box] && paid[box][key]) || [];
    const cuts = [];
    const cols = pillarCols(rp.chart);
    const inp = rp.chart.input;
    const meta = rp.chart.meta || {};
    const birth = `${inp.year}. ${String(inp.month).padStart(2, '0')}. ${String(inp.day).padStart(2, '0')}.`;
    const sub = [inp.calendar === 'lunar' ? '음력' : '양력',
      rp.glyphCount === 6 ? '시각 모름' : `${String(inp.hour).padStart(2, '0')}:${String(inp.minute).padStart(2, '0')}`,
    ].join(' · ');

    // 권두 — 주인공 카드
    cuts.push({ kind: 'card', birth, sub, pillars: cols, term: meta.monthTerm ? `${meta.monthTerm}을 지나 태어남` : '' });

    let bi = 0;
    for (const step of PLAN) {
      // mood 를 scene 컷에 실어 보낸다. 화면이 이 컷에 닿으면 배경색이 그쪽으로 끌려간다.
      cuts.push({ kind: 'scene', anchor: step.anchor, say: step.say,
        mood: step.mood, light: step.light || 0, chapter: step.key });

      if (step.key === 'chart') {
        cuts.push({ kind: 'chart', pillars: cols,
          foot: `${rp.glyphCount === 6 ? '여섯' : '여덟'} 글자예요. 위가 하늘의 기운, 아래가 땅의 기운이에요.` });
        cuts.push(...proseCuts([{ title: rp.type.name, lead: rp.type.headline,
          paras: [rp.type.nounGloss, rp.type.modGloss].filter(Boolean) }]));
        // 표 읽는 법. 이 명식용 깊은 글이 있으면 얹는다.
        cuts.push(...proseCuts([chartOnly(rp.chart, 'intro')]));
      } else if (step.key === 'nature') {
        cuts.push(...proseCuts([whole(lf('natures', rp.type.stem + rp.type.season), pf('natures', rp.type.stem + rp.type.season))]));
      } else if (step.key === 'inout') {
        cuts.push(...proseCuts([
          whole(lf('hiddenFace', rp.hiddenFace && rp.hiddenFace.key), pf('hiddenFace', rp.hiddenFace && rp.hiddenFace.key)),
          whole(lf('firstLook', rp.firstLook && rp.firstLook.key), pf('firstLook', rp.firstLook && rp.firstLook.key)),
        ]));
      } else if (step.key === 'people') {
        cuts.push(...proseCuts([
          whole(lf('beside', rp.beside && rp.beside.key), pf('beside', rp.beside && rp.beside.key)),
          whole(lf('friction', rp.friction && rp.friction.key), pf('friction', rp.friction && rp.friction.key)),
        ]));
      } else if (step.key === 'money') {
        cuts.push(...proseCuts([
          whole(lf('wealth', rp.wealth && rp.wealth.key), pf('wealth', rp.wealth && rp.wealth.key)),
          whole(lf('work', rp.work && rp.work.key), pf('work', rp.work && rp.work.key)),
        ]));
      } else if (step.key === 'flow') {
        const cur = rp.curve && rp.curve[rp.current.idx];
        // 대운 각인 — 딱 한 번, 화면 가득 이름과 나이
        cuts.push({ kind: 'beat', say: `{이름}. ${Math.floor(rp.ageMonths / 12)}살.` });
        if (cur) {
          cuts.push({ kind: 'chart', title: `지금 지나는 십 년 · ${cur.startAge}~${cur.endAge}세`,
            pillars: [{ top: cur.han[0], bot: cur.han[1], tag: cur.ganji }], foot: cur.line });
          cuts.push(...proseCuts([whole(cur.chapter, pf('daeun', cur.chapter && cur.chapter.key))]));
        }
        // 대운 열 줄을 통째로 짚는 글. 태어난 때마다 달라서 이 명식에만 걸린다.
        cuts.push(...proseCuts([chartOnly(rp.chart, 'daeun')]));
        cuts.push(...proseCuts([whole(lf('turning', rp.turning && rp.turning.key), pf('turning', rp.turning && rp.turning.key))]));
      } else if (step.key === 'year') {
        cuts.push(...proseCuts([whole(lf('yearWork', rp.yearWork && rp.yearWork.key), pf('yearWork', rp.yearWork && rp.yearWork.key))]));
        if (rp.flow && rp.flow.year && rp.flow.year.line) {
          cuts.push({ kind: 'prose', paras: [rp.flow.year.line] });
        }
      } else if (step.key === 'end') {
        cuts.push(...proseCuts([chartOnly(rp.chart, 'outro')]));
        cuts.push({ kind: 'card', birth, sub, pillars: cols,
          term: meta.monthTerm ? `${meta.monthTerm}을 지나 태어남` : '',
          tail: `{이름}. **${rp.type.name}**.`, saveable: true });
      }

      if (step.key !== 'end') cuts.push({ kind: 'beat', say: BEATS[bi++ % BEATS.length] });
    }

    return cuts.filter(Boolean);
  }

  return { build, PLAN };
})();

if (typeof module !== 'undefined') module.exports = Story;
