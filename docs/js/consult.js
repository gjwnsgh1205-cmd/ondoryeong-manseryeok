/* ============================================================
 * 상담 세션 (consult.js)
 *
 * 상담은 리포트가 아니라 대화다. 이 파일이 대화의 규칙을 쥔다.
 *   - 남은 질문 수를 세고
 *   - 위기 신호가 보이면 사주 풀이를 멈추고 사람에게 연결하고
 *   - 답변을 어디서 만들지(로컬 규칙 / 서버 AI) 한 곳에서 고른다
 *
 * 백엔드가 붙기 전에도 대화가 굴러가도록 로컬 폴백을 기본으로 둔다.
 * 서버가 준비되면 Consult.setBackend(fn) 하나만 호출하면 된다.
 * ============================================================ */

const Consult = (() => {

  const FREE_TURNS = 2;    // 결제 전에 주고받을 수 있는 횟수
  const PAID_TURNS = 5;    // 이용권 1장으로 더 물을 수 있는 횟수

  // ---------- 위기 신호 ----------
  // 사주보다 사람이 먼저인 순간이 있다. 이때는 풀이를 하지 않는다.
  const CRISIS = [
    '죽고 싶', '죽고싶', '자살', '자해', '살기 싫', '살기싫',
    '사라지고 싶', '사라지고싶', '끝내고 싶', '끝내고싶', '없어지고 싶',
  ];
  const CRISIS_REPLY =
    '잠깐 풀이를 멈출게요.\n\n' +
    '지금 하신 말이 마음에 걸려요. 사주는 이런 순간에 도움이 되지 못해요. ' +
    '지금 필요한 것은 하늘의 흐름이 아니라 사람입니다.\n\n' +
    '자살예방 상담전화 109 — 24시간, 통화료 없이 연결돼요.\n' +
    '정신건강 위기상담 1577-0199\n\n' +
    '지금 당장 누군가와 이야기하세요. 저는 여기 있을게요. 다음에 마음이 좀 가벼워지면 그때 다시 오세요.';

  function isCrisis(text) {
    const t = String(text).replace(/\s/g, '');
    return CRISIS.some(k => t.includes(k.replace(/\s/g, '')));
  }

  // ---------- 답변 백엔드 ----------
  // null이면 로컬 규칙 기반으로 답한다. 서버가 붙으면 여기에 함수를 꽂는다.
  let backend = null;
  function setBackend(fn) { backend = fn; }
  function hasBackend() { return typeof backend === 'function'; }

  // ---------- 세션 ----------
  /**
   * @param {Object} o {topic, chart, ageMonths, situation, partnerChart}
   */
  function start(o) {
    const topic = Topics.byId(o.topic);
    return {
      topic, chart: o.chart, ageMonths: o.ageMonths,
      situation: o.situation || '',
      partnerChart: o.partnerChart || null,
      turns: [],                 // {role:'user'|'doryeong', text}
      used: 0,
      quota: FREE_TURNS,
      paid: false,
      endedByCrisis: false,
    };
  }

  function remaining(s) { return Math.max(0, s.quota - s.used); }

  function grantPass(s) {          // 이용권 사용 — 서버 결제 검증 후 호출
    s.paid = true;
    s.quota += PAID_TURNS;
    return s;
  }

  /** 도령의 첫 마디 — 답이 아니라 되묻기부터 */
  function opening(s) {
    const t = s.topic;
    const intro = Doryeong.resultIntro(s.chart);
    const said = s.situation
      ? `들려주신 이야기, 잘 들었어요.\n\n`
      : '';
    return `${intro}\n\n${said}${t ? t.probe : '어떤 마음으로 오셨어요? 편하게 이야기해 주세요.'}`;
  }

  /** 결제 전에 보여주는 맛보기 — 엔진이 실제로 일하고 있음을 보여준다 */
  function freePreview(s) {
    if (!s.topic) return '';
    return Topics.preview(s.topic.id, s.chart, s.ageMonths);
  }

  /**
   * 사용자의 말에 답한다.
   * @returns {Promise<{text:string, crisis?:boolean, needsPass?:boolean}>}
   */
  async function ask(s, text) {
    s.turns.push({ role: 'user', text });

    if (isCrisis(text)) {
      s.endedByCrisis = true;
      s.turns.push({ role: 'doryeong', text: CRISIS_REPLY });
      return { text: CRISIS_REPLY, crisis: true };
    }

    if (remaining(s) <= 0) {
      const msg = s.paid
        ? '오늘 나눌 이야기는 여기까지예요. 더 묻고 싶다면 이용권을 한 장 더 써보세요.'
        : '여기까지가 그냥 봐드릴 수 있는 만큼이에요. 더 깊이 보려면 이용권이 필요해요.';
      s.turns.push({ role: 'doryeong', text: msg });
      return { text: msg, needsPass: true };
    }

    s.used += 1;
    const answer = hasBackend()
      ? await backend(payload(s, text))
      : localAnswer(s, text);
    s.turns.push({ role: 'doryeong', text: answer });
    return { text: answer };
  }

  /** 서버로 보낼 것 — 생년월일이 아니라 "계산이 끝난 명식"을 보낸다 */
  function payload(s, question) {
    const c = s.chart;
    const p = (x) => x ? `${x.stemInfo.kor}${x.branchInfo.kor}(${x.stemInfo.han}${x.branchInfo.han})` : null;
    const cur = Counsel.currentDaeun(c.daeun, s.ageMonths);
    return {
      topic: { id: s.topic?.id, label: s.topic?.label, focus: s.topic?.focus, care: s.topic?.care },
      chart: {
        pillars: {
          year: p(c.pillars.year), month: p(c.pillars.month),
          day: p(c.pillars.day), hour: p(c.pillars.hour),
        },
        dayStem: Manse.STEMS[c.dayStem].kor,
        monthTerm: c.meta.monthTerm,
        sipseong: c.sipCount,
        elements: Object.fromEntries(Manse.ELEMENTS.map((e, i) => [e.kor, +c.elCount[i].toFixed(1)])),
        hiddenStems: Object.entries(c.pillars).filter(([, v]) => v)
          .map(([k, v]) => [k, v.hidden.map(h => h.info.kor).join('')]),
        daeun: c.daeun.map(d => ({
          from: `${Math.floor(d.startMonths / 12)}세`,
          ganji: `${d.stemInfo.kor}${d.branchInfo.kor}`,
          sip: d.stemSip,
          current: cur.daeun && d.startMonths === cur.daeun.startMonths,
        })),
        yearPillar: (() => { const y = Manse.currentYearPillar(); return `${y.stemInfo.kor}${y.branchInfo.kor}`; })(),
        unknownTime: !!c.meta.assumedNoon,
        boundaryWarning: !!c.meta.boundaryWarning,
      },
      partner: s.partnerChart ? {
        pillars: {
          year: p(s.partnerChart.pillars.year), month: p(s.partnerChart.pillars.month),
          day: p(s.partnerChart.pillars.day), hour: p(s.partnerChart.pillars.hour),
        },
        dayStem: Manse.STEMS[s.partnerChart.dayStem].kor,
      } : null,
      situation: s.situation,
      history: s.turns.slice(-8),
      question,
    };
  }

  // ---------- 로컬 폴백 ----------
  // AI가 붙기 전까지 대화가 끊기지 않게 하는 최소한의 답. 얕다는 걸 숨기지 않는다.
  function localAnswer(s, text) {
    const r = Topics.read(s.chart);
    const f = Topics.flow(s.chart, s.ageMonths);
    const d = f.daeun;
    const season = d ? Manse.SIPSEONG_GROUP[d.stemSip] : null;
    const seasonWord = {
      '비겁': '내 힘으로 서는 계절', '식상': '꺼내놓는 계절', '재성': '거두는 계절',
      '관성': '책임이 무거워지는 계절', '인성': '채우고 쉬는 계절',
    }[season];

    return [
      `${s.topic ? s.topic.label + ' 이야기로 이어갈게요.' : ''}`,
      d ? `지금 ${d.stemInfo.kor}${d.branchInfo.kor} 대운, ${seasonWord}을 지나고 있어요.` : '',
      `일간 ${r.dayStem.kor}${r.dayStem.han}에 ${Manse.ELEMENTS[r.el.indexOf(Math.max(...r.el))].kor} 기운이 두터운 명식이라, ${
        s.topic?.id === 'money' ? '돈은 한 번에 크게 오기보다 흐름을 타고 들어오는 편이에요.'
        : s.topic?.id === 'love' || s.topic?.id === 'reunion' ? '마음을 먼저 여는 쪽일 때가 많아요.'
        : s.topic?.id === 'career' ? '자리보다 사람 때문에 흔들리는 일이 잦은 편이에요.'
        : '결정 앞에서 오래 재는 편이에요.'}`,
      '',
      '다만 여기까지는 명식의 큰 줄기만 읽은 거예요. 들려주신 사정에 맞춰 제대로 짚으려면 더 깊이 들어가야 해요.',
    ].filter(Boolean).join('\n');
  }

  return {
    FREE_TURNS, PAID_TURNS,
    start, ask, opening, freePreview, remaining, grantPass,
    isCrisis, setBackend, hasBackend, payload,
  };
})();

if (typeof module !== 'undefined') module.exports = Consult;
