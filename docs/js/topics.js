/* ============================================================
 * 상담 주제 (topics.js)
 *
 * 주제는 단순한 라벨이 아니라 "명식의 어느 부분을 볼 것인가"를 결정한다.
 * 재물운이면 재성과 식상을, 연애운이면 배우자궁과 관성·재성을 본다.
 *
 * 각 주제가 들고 있는 것
 *   focus    — 어떤 명리 요소를 중심으로 읽을지 (AI 프롬프트의 해석 지침이 된다)
 *   probe    — 도령이 먼저 되묻는 말. 상담은 답부터가 아니라 질문부터 시작한다
 *   preview  — 결제 전 무료로 보여주는 규칙 기반 미리보기
 *   care     — 이 주제에서 넘지 말아야 할 선
 * ============================================================ */

const Topics = (() => {

  // ---------- 명식에서 자주 쓰는 값 뽑기 ----------
  function read(chart) {
    const g = {};
    for (const [k, v] of Object.entries(chart.sipCount)) {
      g[Manse.SIPSEONG_GROUP[k]] = (g[Manse.SIPSEONG_GROUP[k]] || 0) + v;
    }
    const total = Object.values(g).reduce((a, b) => a + b, 0) || 1;
    const dayBranch = chart.pillars.day.branchInfo;   // 일지 = 배우자궁
    const monthBranch = chart.pillars.month.branchInfo;
    return {
      grp: (name) => g[name] || 0,
      share: (name) => (g[name] || 0) / total,
      strong: (name) => (g[name] || 0) >= 2,
      none: (name) => !(g[name] > 0),
      dayBranch, monthBranch,
      dayStem: Manse.STEMS[chart.dayStem],
      el: chart.elCount,
      isFemale: chart.input.gender === 'F',
    };
  }

  // 현재 대운·세운이 일간에게 무슨 십성인지
  function flow(chart, ageMonths) {
    const cur = Counsel.currentDaeun(chart.daeun, ageMonths);
    const dae = cur.daeun
      ? Manse.SIPSEONG_GROUP[cur.daeun.stemSip] : null;
    const yp = Manse.currentYearPillar();
    const se = Manse.SIPSEONG_GROUP[Manse.sipseong(chart.dayStem, yp.stem)];
    return { daeunGroup: dae, daeun: cur.daeun, yearPillar: yp, yearGroup: se };
  }

  // 미리보기 문장 조립기 — 명식에서 실제로 성립하는 것만 말한다
  const line = (cond, text) => (cond ? text : null);
  const build = (...parts) => parts.filter(Boolean).join(' ');

  // ---------- 주제 정의 ----------
  const LIST = [
    {
      id: 'money',
      group: '돈과 일',
      label: '재물운',
      banner: '돈이 언제쯤 풀릴지 궁금해요',
      probe: '돈 이야기를 하러 오셨군요. 지금은 버는 게 문제인가요, 모이지 않는 게 문제인가요? 사정을 조금만 들려주세요.',
      focus: '재성(정재·편재)의 강약과 위치, 식상이 재성을 생하는지, 비겁이 재성을 나누어 가지는지, 대운과 세운에 재성이 들어오는 시기',
      care: '구체적 금액이나 수익률을 말하지 말 것. 투자 종목 추천 금지.',
      preview(chart, f, r) {
        return build(
          `명식의 재성은 ${r.grp('재성')}자리예요.`,
          line(r.strong('재성'), '재물을 다루는 감각이 타고났고, 돈이 눈에 보이는 사람이에요.'),
          line(r.none('재성'), '원국에 재성이 드러나지 않았어요. 없다는 뜻이 아니라, 재물이 지장간에 숨어 때를 기다린다는 뜻이에요.'),
          line(r.strong('식상'), '식상이 튼튼하니 재주가 돈으로 이어지는 구조예요.'),
          line(r.strong('비겁'), '다만 비겁이 강해 재물을 나누어 갖는 모양이라, 동업과 보증은 늘 조심할 자리예요.'),
          f.daeunGroup === '재성' ? '지금 대운이 바로 재성의 계절이에요. 벌이가 움직이는 시기예요.'
            : f.yearGroup === '재성' ? '올해 세운에 재성이 들어와요. 한 해의 흐름은 나쁘지 않아요.' : '',
        );
      },
    },
    {
      id: 'love',
      group: '사랑',
      label: '연애운',
      banner: '인연이 언제쯤 올까요',
      probe: '인연을 물으러 오셨군요. 지금 마음에 둔 사람이 있나요, 아니면 아직 만나지 못했나요?',
      focus: '배우자궁인 일지의 상태, 여명은 관성 남명은 재성의 강약, 도화·홍염의 유무, 대운과 세운에 배우자성이 들어오는 시기',
      care: '만날 시기를 날짜로 단정하지 말 것. 특정 인물을 지목하지 말 것.',
      preview(chart, f, r) {
        const key = r.isFemale ? '관성' : '재성';
        return build(
          `배우자궁은 일지 ${r.dayBranch.kor}${r.dayBranch.han}, ${r.dayBranch.animal}의 자리예요.`,
          line(r.strong(key), `${key}이 뚜렷하니 인연이 드나드는 문이 넓은 편이에요.`),
          line(r.none(key), `원국에 ${key}이 드러나지 않았어요. 인연이 없다는 말이 아니라, 늦게 또는 뜻밖의 자리에서 온다는 뜻이에요.`),
          f.daeunGroup === key ? '지금 대운에 그 기운이 들어와 있어요. 사람이 들어올 문이 열린 때예요.'
            : f.yearGroup === key ? '올해 세운에 그 기운이 들어와요.' : '',
        );
      },
    },
    {
      id: 'reunion',
      group: '사랑',
      label: '재회운',
      banner: '떠난 사람이 아직 마음에 남아',
      probe: '마음이 많이 무거우셨겠어요. 헤어진 지는 얼마나 되었나요? 그리고 하나만 물을게요 — 다시 만나고 싶은 것인지, 아니면 매듭을 짓고 싶은 것인지.',
      focus: '일지의 충·합 여부, 이별 시점의 대운과 세운, 관성 또는 재성의 손상과 회복, 원국이 재회에 열려 있는 구조인지',
      care: '상대의 마음을 대신 말하지 말 것("그 사람도 당신을 그리워한다" 금지). 재회를 약속하지 말 것. 기다림을 부추기지 말 것. 놓아주는 선택도 동등하게 존중할 것.',
      needsPartner: true,
      partnerOptional: true,
      preview(chart, f, r) {
        return build(
          `먼저 하나 짚고 갈게요. 사주는 상대의 마음을 읽는 도구가 아니에요. 이쪽의 흐름만 볼 수 있어요.`,
          `배우자궁은 ${r.dayBranch.kor}${r.dayBranch.han}입니다.`,
          line(f.daeunGroup === '비겁', '지금 대운은 자기를 다시 세우는 계절이라, 관계보다 자기 자신이 중심에 오는 때예요.'),
          line(f.daeunGroup === '인성', '지금 대운은 안을 채우는 계절이니, 서둘러 답을 내기보다 마음을 회복할 시기로 보여요.'),
          '다시 만나는 일이 늘 좋은 것도, 늘 나쁜 것도 아니에요. 어느 쪽이든 상하지 않는 길을 함께 찾아봐요.',
        );
      },
    },
    {
      id: 'match',
      group: '사랑',
      label: '궁합',
      banner: '이 사람과 잘 맞을지 보고 싶어요',
      probe: '두 사람을 함께 보려면 상대의 생년월일도 필요해요. 아는 만큼만 알려주세요.',
      focus: '두 일간의 생극 관계, 일지끼리의 합·충·형, 서로의 용신을 채워주는지, 대운의 시기가 맞물리는지',
      care: '헤어지라거나 만나지 말라고 단정하지 말 것. 궁합이 나쁘다는 말로 관계를 끝내게 하지 말 것.',
      needsPartner: true,
      preview(chart, f, r) {
        return build(
          `일간은 ${r.dayStem.kor}${r.dayStem.han}, 일지는 ${r.dayBranch.kor}${r.dayBranch.han}입니다.`,
          '상대의 생년월일을 알려주면 두 명식을 나란히 놓고 볼게요.',
          '미리 말해두지만 궁합은 합격과 불합격을 가르는 시험이 아니에요. 어디가 잘 맞고 어디를 조심하면 되는지를 보는 거예요.',
        );
      },
    },
    {
      id: 'career',
      group: '돈과 일',
      label: '이직 · 취업운',
      banner: '지금 자리를 옮겨도 될지',
      probe: '일자리 이야기군요. 지금 옮기려는 이유가 무엇인가요 — 사람인가요, 일 자체인가요, 아니면 돈인가요?',
      focus: '관성(직장·조직)의 강약과 안정성, 인성(문서·자격)의 유무, 식상이 관성을 치는지, 대운과 세운의 관성 변화',
      care: '퇴사를 부추기지 말 것. 합격 여부를 단정하지 말 것.',
      preview(chart, f, r) {
        return build(
          `관성이 ${r.grp('관성')}자리, 인성이 ${r.grp('인성')}자리예요.`,
          line(r.strong('관성'), '조직 안에서 자리를 얻고 지키는 힘이 있는 명식이에요.'),
          line(r.none('관성'), '원국에 관성이 드러나지 않았어요. 짜인 조직보다 자기 방식이 통하는 자리가 편한 사람이에요.'),
          line(r.strong('식상') && r.strong('관성'), '다만 식상이 관성을 치는 구조라, 답답한 규칙 앞에서 뛰쳐나가고 싶어지는 때가 와요.'),
          f.daeunGroup === '관성' ? '지금 대운이 관성의 계절이니, 자리와 책임이 커지는 시기예요.'
            : f.daeunGroup === '식상' ? '지금 대운은 표현의 계절이라, 기존 틀이 답답해지기 쉬운 때예요.' : '',
        );
      },
    },
    {
      id: 'business',
      group: '돈과 일',
      label: '사업 · 창업운',
      banner: '벌여도 될 때인지 알고 싶어요',
      probe: '벌이려는 일이 무엇인지, 그리고 혼자인지 함께인지 들려주세요.',
      focus: '편재의 유무, 식상생재의 성립 여부, 비겁의 세력(동업과 분배), 대운이 확장기인지 수성기인지',
      care: '투자 권유나 금액 조언 금지. 창업하라고 등 떠밀지 말 것.',
      preview(chart, f, r) {
        return build(
          line(r.strong('식상') && r.grp('재성') > 0, '식상이 재성을 생하는 구조가 보여요. 스스로 만들어 파는 일에 맞는 명식이에요.'),
          line(r.strong('비겁'), '비겁이 강하니 동업은 지분과 역할을 문서로 못박아야 탈이 없어요.'),
          line(r.none('재성'), '원국에 재성이 없으니 큰 판을 벌이기보다 작게 시작해 키우는 쪽이 순리예요.'),
          f.daeunGroup === '재성' || f.daeunGroup === '식상'
            ? '지금 대운은 벌이고 확장하는 계절에 가까워요.'
            : '지금 대운은 벌이기보다 지키고 채우는 계절에 가까워요.',
        );
      },
    },
    {
      id: 'year',
      group: '때와 마음',
      label: '올해 운세',
      banner: '올 한 해가 어떻게 흐를지',
      probe: '올해를 보러 오셨군요. 특별히 마음에 걸리는 일이 있나요?',
      focus: '올해 세운의 간지와 원국의 관계, 세운이 대운과 어떻게 맞물리는지, 월별로 기운이 바뀌는 지점',
      care: '사고·질병·죽음을 예고하지 말 것.',
      preview(chart, f, r) {
        const y = f.yearPillar;
        return build(
          `올해는 ${y.stemInfo.kor}${y.branchInfo.kor}(${y.stemInfo.han}${y.branchInfo.han})년이에요.`,
          `일간 ${r.dayStem.kor}에게는 ${f.yearGroup}의 해예요.`,
          f.yearGroup === '재성' ? '움직이면 결과가 보이는 해예요.'
            : f.yearGroup === '관성' ? '책임과 자리가 늘어나는 해예요.'
            : f.yearGroup === '인성' ? '배우고 채우는 해예요. 조급함이 가장 큰 적이에요.'
            : f.yearGroup === '식상' ? '표현하고 꺼내놓는 해예요.'
            : '내 힘으로 서는 해예요.',
        );
      },
    },
    {
      id: 'turning',
      group: '때와 마음',
      label: '선택의 기로',
      banner: '결정을 못 하겠어요',
      probe: '갈림길에 서 계시는군요. 두 갈래가 각각 무엇인지 말해주세요. 어느 쪽이 더 마음이 가는지도 함께.',
      focus: '대운의 전환 시점과 남은 기간, 원국의 용신 방향, 지금 결정이 대운의 흐름과 같은 방향인지 거스르는지',
      care: '대신 결정해주지 말 것. 선택의 근거를 주되 판단은 본인에게 돌릴 것.',
      preview(chart, f, r) {
        const d = f.daeun;
        return build(
          d ? `지금은 ${d.stemInfo.kor}${d.branchInfo.kor} 대운, ${Manse.SIPSEONG_GROUP[d.stemSip]}의 계절을 지나고 있어요.` : '',
          '사주는 어느 쪽을 고르라고 말해주지 않아요. 다만 지금이 밀고 나갈 때인지 기다릴 때인지는 짚어줄 수 있어요.',
        );
      },
    },
    {
      id: 'mind',
      group: '때와 마음',
      label: '마음이 지칠 때',
      banner: '요즘 마음이 많이 무거워요',
      probe: '많이 지치셨군요. 언제부터 그랬는지, 무엇이 가장 무거운지 편하게 이야기해 주세요.',
      focus: '일간의 강약과 통근 여부, 오행의 편중, 인성(쉼과 회복)의 유무, 대운이 소모의 계절인지 회복의 계절인지',
      care: '정신과 진단·치료 대체 금지. 위기 신호가 보이면 즉시 전문 상담을 안내할 것.',
      preview(chart, f, r) {
        const E = Manse.ELEMENTS;
        const max = r.el.indexOf(Math.max(...r.el));
        const min = r.el.indexOf(Math.min(...r.el));
        return build(
          `명식은 ${E[max].kor} 기운이 가장 두텁고, ${E[min].kor} 기운이 가장 옅어요.`,
          line(r.none('인성'), '원국에 인성이 없어요. 쉬는 법을 배우지 못한 채 살아온 사람일 때가 많아요.'),
          line(r.strong('식상') && r.grp('인성') === 0, '내어주기만 하고 채우지 못하는 구조예요. 지치는 게 당연해요.'),
          '마음이 무거운 날엔 사주보다 사람이 먼저예요. 곁에 기댈 사람을 꼭 두세요.',
        );
      },
    },
  ];

  const byId = (id) => LIST.find(t => t.id === id) || null;
  const groups = () => [...new Set(LIST.map(t => t.group))];

  /** 주제별 무료 미리보기 생성 */
  function preview(topicId, chart, ageMonths) {
    const t = byId(topicId);
    if (!t) return '';
    return t.preview(chart, flow(chart, ageMonths), read(chart));
  }

  return { LIST, byId, groups, preview, read, flow };
})();

if (typeof module !== 'undefined') module.exports = Topics;
