/* ============================================================
   situation.js — 19,800원짜리 풀이를 쓰기 위해 묻는 여덟 가지.

   무료 구간은 명식만 있으면 된다. 미리 지어둔 글을 조합하면 되니까.
   이 값을 받는 이유는 하나다 — 미리 지어둘 수 없는 글을 쓰기 때문이다.
   그러니 질문은 "이 답을 쓰는 데 실제로 필요한 것"만이어야 한다.

   설계 원칙
     · 여덟 개. 넷이면 대충 묻는 것 같고, 열둘이면 결제하고도 나간다.
     · 첫 문항만 필수다. 나머지는 다 건너뛸 수 있다.
     · 대부분 고르기다. 타이핑은 처음과 끝 두 번뿐.
     · 민감정보는 묻지 않는다. 병명·진단·빚 액수·종교·정치 성향은 받지 않는다.
       건강은 "지친 정도"까지만 묻고, 그것도 답을 주려는 게 아니라
       힘든 사람에게 몰아붙이는 말을 안 하기 위해서다.
   ============================================================ */
const Situation = (() => {
  'use strict';

  const FIELDS = [
    {
      id: 'concern', type: 'text', required: true, rows: 4,
      q: '지금 가장 마음에 걸리는 일이 무엇인가요?',
      hint: '길게 쓰지 않아도 괜찮아요. 다만 구체적일수록 제대로 짚어드릴 수 있어요.',
      placeholder: '예) 3년 다닌 회사에서 팀장을 맡아 달라는 말을 들었습니다. '
        + '그런데 원래 하고 싶던 일이 따로 있어서, 지금 자리를 굳히면 영영 못 갈 것 같아 망설여져요.',
      // 자유 서술이 있어야 "내 이야기를 듣고 쓴 글"이 된다. 이것만 필수인 이유다.
    },
    {
      id: 'want', type: 'pick',
      q: '어떤 답이 필요하세요?',
      hint: '같은 명식이라도 무엇을 찾느냐에 따라 짚는 자리가 달라져요.',
      options: [
        ['decide', '결정을 내려야 한다'],
        ['endure', '견디는 중이라 기댈 말이 필요하다'],
        ['people', '사람을 이해하고 싶다'],
        ['timing', '때를 알고 싶다'],
      ],
    },
    {
      id: 'work', type: 'pick', other: '몇 년째인지도 적어주세요',
      q: '요즘 하시는 일은',
      options: [
        ['office', '회사에 다닌다'],
        ['own', '내 일을 한다'],
        ['free', '프리랜서로 일한다'],
        ['study', '공부하는 중이다'],
        ['seek', '일을 찾는 중이다'],
        ['rest', '쉬는 중이다'],
      ],
    },
    {
      id: 'relation', type: 'pick',
      q: '요즘 사람 관계는 어떠세요?',
      hint: '말하기 어려우면 건너뛰어도 괜찮아요.',
      options: [
        ['alone', '혼자다'],
        ['dating', '만나는 사람이 있다'],
        ['married', '가정을 이뤘다'],
        ['broke', '얼마 전에 헤어졌다'],
        ['messy', '복잡하다'],
      ],
    },
    {
      id: 'changed', type: 'multi',
      q: '최근 한 해에 크게 바뀐 것이 있나요?',
      hint: '여럿 골라도 괜찮아요.',
      options: [
        ['job', '일을 옮겼다'],
        ['move', '사는 곳을 옮겼다'],
        ['part', '가까운 사람과 헤어졌다'],
        ['loss', '가까운 이를 떠나보냈다'],
        ['family', '식구가 늘었다'],
        ['start', '새로 벌인 일이 있다'],
        ['none', '별일 없었다'],
      ],
    },
    {
      id: 'money', type: 'pick',
      q: '돈 사정은 어떠세요?',
      // 액수나 빚은 묻지 않는다. 어느 쪽으로 조언이 기울면 안 되는지만 알면 된다.
      hint: '액수는 묻지 않아요. 조언의 무게를 맞추려는 것뿐이에요.',
      options: [
        ['ok', '여유가 있다'],
        ['mid', '보통이다'],
        ['tight', '빠듯하다'],
      ],
    },
    {
      id: 'body', type: 'pick',
      q: '요즘 몸과 마음은 어떠세요?',
      // 병명이나 진단은 받지 않는다. 지친 사람에게 몰아붙이는 말을 안 하기 위한 눈금이다.
      hint: '아픈 데를 묻는 게 아니에요. 몰아붙이지 않으려고 여쭤보는 거예요.',
      options: [
        ['fine', '괜찮다'],
        ['tired', '좀 지쳤다'],
        ['worn', '많이 지쳤다'],
      ],
    },
    {
      id: 'when', type: 'pick',
      q: '이 답을 언제 쓰실 건가요?',
      options: [
        ['now', '당장 정해야 한다'],
        ['soon', '몇 달 안에'],
        ['know', '그냥 알아두고 싶다'],
      ],
    },
  ];

  const LABEL = {};
  FIELDS.forEach((f) => {
    if (!f.options) return;
    LABEL[f.id] = Object.fromEntries(f.options);
  });

  /* 서버(그리고 AI)로 넘길 꼴.
     생년월일은 보내지 않는다 — 이미 계산이 끝난 명식만 보내면 되기 때문이다. */
  function pack(values) {
    const out = {};
    for (const f of FIELDS) {
      const v = values[f.id];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (f.type === 'multi') out[f.id] = v.map((k) => LABEL[f.id][k] || k);
      else if (f.type === 'pick') out[f.id] = LABEL[f.id][v] || v;
      else out[f.id] = String(v).slice(0, 1200);   // 너무 길면 잘라 보낸다
    }
    if (values.workYears) out.workYears = String(values.workYears).slice(0, 40);
    return out;
  }

  // 몇 개나 채웠는지 — 화면에 "여덟 중 다섯" 처럼 보여주기 위해
  function filled(values) {
    return FIELDS.filter((f) => {
      const v = values[f.id];
      return v != null && v !== '' && !(Array.isArray(v) && !v.length);
    }).length;
  }

  function validate(values) {
    const c = (values.concern || '').trim();
    if (c.length < 10) return '지금 마음에 걸리는 일을 한두 줄이라도 적어주세요. 그래야 이야기를 얹어 쓸 수 있어요.';
    return null;
  }

  /* 힘든 상태를 답한 사람에게는 답의 무게를 달리 실어야 한다.
     "밀어붙이시게" 같은 말이 나가면 안 되는 자리다. */
  function careFlags(values) {
    const f = [];
    if (values.body === 'worn') f.push('많이 지친 상태 — 몰아붙이는 조언을 하지 말 것');
    if (values.relation === 'broke' || (values.changed || []).includes('part')) {
      f.push('이별 직후 — 재회를 약속하거나 상대 마음을 대신 말하지 말 것');
    }
    if ((values.changed || []).includes('loss')) f.push('상실 직후 — 위로가 먼저, 조언은 나중');
    if (values.money === 'tight') f.push('돈이 빠듯함 — 돈 쓰는 조언을 권하지 말 것');
    if (values.work === 'seek' || values.work === 'rest') f.push('일을 쉬는 중 — 조급하게 만들지 말 것');
    return f;
  }

  return { FIELDS, LABEL, pack, filled, validate, careFlags };
})();

if (typeof module !== 'undefined') module.exports = Situation;
