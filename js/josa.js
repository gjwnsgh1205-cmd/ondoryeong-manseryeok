/* ============================================================
   josa.js — 슬롯에 들어간 낱말에 맞춰 조사를 고른다.

   왜 필요한가.
   긴 글에 {물상} 같은 슬롯을 뒀는데, 글 쓰는 쪽에서 조사를 직접 붙여놨다.
   물상 열 개 중 큰 나무·산마루·무쇠·바다는 받침이 없다. 그대로 두면
   "바다이 하나 더 서 있는", "무쇠이 닿는 자리", "산마루이 제 자리를 찾아"가
   화면에 뜬다. 절반의 사용자가 앱을 켜자마자 깨진 한국어를 본다.

   그래서 조사는 글이 아니라 코드가 고른다.
   글에는 "{물상}은" 처럼 대표형 하나만 적어두고, 여기서 받침을 보고 바꾼다.

   까다로운 자리가 셋 있다.
     · 한자와 숫자 — "甲" 이나 "3" 은 읽는 소리로 받침을 따져야 한다.
     · 로마자 — "AI" 는 '아이'라 받침이 없다.
     · '으로/로' — ㄹ 받침은 예외다. "산마루로" 가 아니라 "이슬로" 처럼.
   ============================================================ */
const Josa = (() => {
  'use strict';

  /* 대표형 → [받침 있을 때, 받침 없을 때] */
  const PAIR = {
    '은': ['은', '는'], '는': ['은', '는'],
    '이': ['이', '가'], '가': ['이', '가'],
    '을': ['을', '를'], '를': ['을', '를'],
    '과': ['과', '와'], '와': ['과', '와'],
    '아': ['아', '야'], '야': ['아', '야'],
    '이나': ['이나', '나'], '나': ['이나', '나'],
    '이라': ['이라', '라'], '라': ['이라', '라'],
    '이란': ['이란', '란'], '란': ['이란', '란'],
    '이랑': ['이랑', '랑'], '랑': ['이랑', '랑'],
    '이야': ['이야', '야'],
    '이에요': ['이에요', '예요'], '예요': ['이에요', '예요'],
    '이었': ['이었', '였'], '였': ['이었', '였'],
    '으로': ['으로', '로'], '로': ['으로', '로'],
    '으로서': ['으로서', '로서'], '로서': ['으로서', '로서'],
    '으로써': ['으로써', '로써'], '로써': ['으로써', '로써'],
  };

  /* 숫자와 한자는 눈이 아니라 소리로 받침을 따진다. 마지막 글자만 보면 된다. */
  const DIGIT_JONG = { '0': true, '1': true, '3': true, '6': true, '7': true, '8': true,
                       '2': false, '4': false, '5': false, '9': false };
  /* 로마자는 한국어로 읽었을 때의 끝소리로 본다 */
  const ALPHA_JONG = { l: true, m: true, n: true, r: true, g: true, b: true, k: true, p: true, t: true, c: true, d: true };

  /* 받침이 있는가, 그리고 그게 ㄹ 인가 */
  function tail(word) {
    let s = String(word).trim();
    /* 간지는 "병오(丙午)" 처럼 한자를 괄호에 달고 온다. 조사는 눈이 아니라
       소리를 따르니, 괄호를 떼고 앞의 한글로 따진다 — 병오는 '오'라 받침이 없다.
       괄호를 그대로 두고 한자로 판단하면 "병오(丙午)은" 이 된다. */
    const bare = s.replace(/\s*[(（][^)）]*[)）]\s*$/, '');
    if (bare && /[가-힣]$/.test(bare)) s = bare;
    s = s.replace(/[)\]}"'’”\s.,!?·]+$/, '');
    const ch = s[s.length - 1];
    if (!ch) return { jong: false, rieul: false };

    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const j = (code - 0xAC00) % 28;
      return { jong: j !== 0, rieul: j === 8 };
    }
    if (/[0-9]/.test(ch)) return { jong: !!DIGIT_JONG[ch], rieul: ch === '1' || ch === '7' || ch === '8' };
    if (/[a-zA-Z]/.test(ch)) {
      const low = ch.toLowerCase();
      return { jong: !!ALPHA_JONG[low], rieul: low === 'l' || low === 'r' };
    }
    // 한자는 소리를 모르면 판단할 수 없다. 받침 있는 쪽으로 두는 편이 덜 어색하다.
    if (code >= 0x4E00 && code <= 0x9FFF) return { jong: true, rieul: false };
    return { jong: false, rieul: false };
  }

  /* 낱말 하나에 조사 하나 */
  function pick(word, josa) {
    const p = PAIR[josa];
    if (!p) return josa;
    const t = tail(word);
    // 으로/로 만 ㄹ 받침이 예외다 — "이슬로" 이지 "이슬으로" 가 아니다
    if (p[0].startsWith('으로') && t.rieul) return p[1];
    return t.jong ? p[0] : p[1];
  }

  /* 슬롯을 채우면서 뒤따르는 조사까지 함께 고른다.
       fill('{물상}은 오래 갑니다', { 물상: '바다' })  →  '바다는 오래 갑니다'
     슬롯 뒤에 조사가 없으면 값만 갈아 끼운다. */
  const JOSA_RE = new RegExp('^(' + Object.keys(PAIR).sort((a, b) => b.length - a.length).join('|') + ')');

  function fill(text, values) {
    let s = String(text);
    const name = values && values.이름;
    // 이름이 비면 호칭을 통째로 지운다. 슬롯만 지우면 "님은 지금" / "!" 가 남는다.
    if (!name) {
      s = s.replace(/\{이름\}님(은|이|가|는|께서)?\s*/g, '');
      s = s.replace(/\{이름\}([가-힣]{0,3})?\s*[,.!?…·]*\s*/g, '');
    }
    // 슬롯 이름이 한글이다. \w 는 한글을 안 잡아서 아무것도 안 바뀐다.
    return s.replace(/\{([^{}\s]+)\}([가-힣]*)/g, (whole, key, after) => {
      if (!values || !(key in values)) return whole;
      const v = values[key];
      if (v == null || v === '') return after;
      const m = after.match(JOSA_RE);
      if (!m) return v + after;
      return v + pick(v, m[1]) + after.slice(m[1].length);
    });
  }

  return { pick, fill, tail };
})();

if (typeof module !== 'undefined') module.exports = Josa;
