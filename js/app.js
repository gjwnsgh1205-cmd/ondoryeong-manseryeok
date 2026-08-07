/* ============================================================
 * 앱 로직 (app.js) — 입력 → 명식 계산 → 상담 렌더링
 * ============================================================ */

(() => {
  const $ = (sel) => document.querySelector(sel);
  const E = Manse.ELEMENTS;
  const EL_COLORS = ['var(--el-wood)', 'var(--el-fire)', 'var(--el-earth)', 'var(--el-metal)', 'var(--el-water)'];

  let lastResult = null; // { chart, counsel, age }

  // ---------- 유틸 ----------
  function koreanAge(y, m, d) {
    // 만 나이
    const now = new Date();
    let age = now.getFullYear() - y;
    const bd = new Date(now.getFullYear(), m - 1, d);
    if (now < bd) age -= 1;
    return age;
  }
  function ageInMonths(y, m, d) {
    // 만 나이 총개월 (대운 구간 판정용)
    const now = new Date();
    let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    if (now.getDate() < d) months -= 1;
    return Math.max(0, months);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 폼 ----------
  const form = $('#birth-form');
  const unknownCk = $('#f-unknown-time');
  unknownCk.addEventListener('change', () => {
    const dis = unknownCk.checked;
    $('#f-hour').disabled = dis;
    $('#f-minute').disabled = dis;
    if (dis) { $('#f-hour').value = ''; $('#f-minute').value = ''; }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const year = +$('#f-year').value;
    const month = +$('#f-month').value;
    const day = +$('#f-day').value;
    const unknownTime = unknownCk.checked;
    const hour = unknownTime ? 12 : +($('#f-hour').value || 0);
    const minute = unknownTime ? 0 : +($('#f-minute').value || 0);
    const gender = document.querySelector('input[name=gender]:checked').value;
    const useTrueSolar = $('#f-true-solar').checked;

    // 날짜 유효성
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
      alert('존재하지 않는 날짜예요. 다시 확인해 주세요.');
      return;
    }
    const birthDT = unknownTime ? dt : new Date(year, month - 1, day, hour, minute);
    if (birthDT > new Date()) {
      alert('미래의 날짜·시각은 풀이할 수 없어요. 태어난 날짜를 확인해 주세요.');
      return;
    }
    if (!unknownTime && ($('#f-hour').value === '' || $('#f-minute').value === '')) {
      alert('태어난 시각을 입력하거나 "시각을 몰라요"를 선택해 주세요.');
      return;
    }

    let chart;
    try {
      chart = Manse.compute({ year, month, day, hour, minute, gender, unknownTime, useTrueSolar });
    } catch (err) {
      alert(err.message || '계산 중 문제가 생겼어요. 입력을 확인해 주세요.');
      return;
    }
    const age = koreanAge(year, month, day);
    const ageMonths = ageInMonths(year, month, day);
    const counsel = Counsel.concernCards(chart, age, ageMonths);
    lastResult = { chart, counsel, age, ageMonths };

    renderAll(chart, counsel, age, ageMonths);
    $('#input-section').classList.add('hidden');
    $('#result-section').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#btn-again').addEventListener('click', () => {
    $('#result-section').classList.add('hidden');
    $('#input-section').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- 렌더링 ----------
  function renderAll(chart, counsel, age, ageMonths) {
    renderToday(chart);
    renderPillars(chart);
    renderElements(chart, counsel);
    renderDayMaster(chart);
    renderDaeun(chart, counsel, age, ageMonths);
    renderConcerns(counsel);
  }

  // 총개월 → "N세" 또는 "N세 M개월"
  function fmtAgeM(months) {
    const y = Math.floor(months / 12), mo = months % 12;
    return `${y}세` + (mo ? ` ${mo}개월` : '');
  }

  function renderToday(chart) {
    const t = Counsel.todayMessage(chart);
    $('#today-card').innerHTML = `
      <div class="today-ganji">${t.iljin.stemInfo.han}${t.iljin.branchInfo.han}
        <small>오늘 · ${t.iljin.stemInfo.kor}${t.iljin.branchInfo.kor}일</small>
      </div>
      <div class="today-body">
        <h3>오늘의 한 마디 · ${esc(t.sip)}의 날</h3>
        <p>${esc(t.msg)}</p>
      </div>`;
  }

  function renderPillars(chart) {
    const p = chart.pillars;
    const inp = chart.input;
    const timeStr = inp.unknownTime ? '시각 모름' :
      `${String(inp.hour).padStart(2, '0')}:${String(inp.minute).padStart(2, '0')}`;
    $('#chart-birth-info').textContent =
      `${inp.year}. ${inp.month}. ${inp.day}. ${timeStr} · ${inp.gender === 'M' ? '남' : '여'}`;

    const mk = (pl, key) => {
      if (!pl) return `<div class="pillar"><div class="pillar-label">시주</div><div class="pillar-empty">시각 정보 없음</div></div>`;
      const isDay = key === 'day';
      const stemSip = isDay ? '일간 · 나' : pl.stemSipseong;
      const hid = pl.hidden.map(h => h.info.kor).join('·');
      return `
        <div class="pillar">
          <div class="pillar-label"><b>${pl.label}</b></div>
          <div class="glyph-stack">
            <div class="glyph el-${pl.stemInfo.el} ${isDay ? 'day-stem' : ''}">
              <span class="han">${pl.stemInfo.han}</span>
              <span class="kor">${pl.stemInfo.kor} · ${E[pl.stemInfo.el].kor}</span>
              <span class="sip">${esc(stemSip)}</span>
            </div>
            <div class="glyph el-${pl.branchInfo.el}">
              <span class="han">${pl.branchInfo.han}</span>
              <span class="kor">${pl.branchInfo.kor} · ${E[pl.branchInfo.el].kor} · ${pl.branchInfo.animal}</span>
              <span class="sip">${esc(pl.branchSipseong)}</span>
            </div>
          </div>
          <div class="hidden-stems">지장간 ${hid}</div>
        </div>`;
    };

    // 전통 서식(오른쪽→왼쪽: 연월일시)을 CSS direction:rtl로 처리 — DOM 순서는 연월일시
    $('#pillar-board').innerHTML =
      mk(p.year, 'year') + mk(p.month, 'month') + mk(p.day, 'day') + mk(p.hour, 'hour');

    const m = chart.meta;
    const adj = m.adjusted;
    let note = `절기 기준 ${m.sajuYear}년주 · ${m.monthTerm} 이후 월주`;
    if (!inp.unknownTime) {
      note += ` · 보정 시각 ${String(adj.hh).padStart(2, '0')}:${String(adj.mm).padStart(2, '0')}`;
      if (m.useTrueSolar) note += ' (경도 보정 −30분)';
    } else {
      note += ' · 시각 미상 — 정오(12:00) 가정';
    }
    const warns = [];
    if (m.boundaryWarning) {
      warns.push(`⚠ 절기(${m.nearestTermName}) 경계에서 약 ${m.nearestTermMin}분 이내의 출생이에요. 출생 시각이 몇 분만 달라져도 연주·월주가 바뀔 수 있으니, 출생증명서 등으로 시각을 한 번 더 확인해 보세요.`);
    } else if (m.termDayWarning) {
      warns.push(`⚠ 태어난 날이 절기(${m.nearestTermName}) 절입일과 가까워요. 시각을 모르는 경우 연주·월주가 실제와 다를 수 있습니다.`);
    }
    if (m.timeStatus === 'fold') {
      warns.push('⚠ 서머타임이 끝나며 두 번 존재했던 시각이에요. 여기서는 표준시 기준으로 해석했습니다.');
    }
    if (!m.precise) {
      warns.push('⚠ 정밀 천문 계산 모듈을 불러오지 못해 근사 계산(±15분)을 사용했어요. 절기 경계 부근이라면 결과가 달라질 수 있습니다.');
    }
    $('#board-note').innerHTML = esc(note) + warns.map(w => `<br><span class="note-warn">${esc(w)}</span>`).join('');
  }

  function renderElements(chart, counsel) {
    const max = Math.max(...chart.elCount, 1);
    $('#element-chart').innerHTML = chart.elCount.map((v, i) => {
      const st = counsel.analysis[i].state;
      const badge = st === 'excess' ? '<span class="el-state excess">강함</span>'
        : st === 'lack' ? '<span class="el-state lack">옅음</span>' : '';
      return `
      <div class="el-row">
        <div class="el-name">${E[i].kor}<span class="han">${E[i].han}</span>${badge}</div>
        <div class="el-track"><div class="el-fill" data-w="${(v / max * 100).toFixed(0)}" style="background:${EL_COLORS[i]}"></div></div>
        <div class="el-val">${v.toFixed(1)}</div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => {
      document.querySelectorAll('.el-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
    });

    const excess = counsel.analysis.filter(a => a.state === 'excess');
    const lack = counsel.analysis.filter(a => a.state === 'lack');
    let html = '';
    if (excess.length === 0 && lack.length === 0) {
      html = `<p><span class="theme">고른 흐름</span> — 다섯 기운이 비교적 고르게 흐르고 있어요. ${esc(Counsel.ELEMENT_PSY[chart.pillars.day.stemInfo.el].balanced)}</p>`;
    } else {
      for (const a of excess) {
        html += `<p><span class="theme">${E[a.el].kor}(${esc(Counsel.ELEMENT_PSY[a.el].theme)})이 강한 편</span> — ${esc(Counsel.ELEMENT_PSY[a.el].excess)}</p>`;
      }
      for (const a of lack) {
        html += `<p><span class="theme">${E[a.el].kor}(${esc(Counsel.ELEMENT_PSY[a.el].theme)})이 옅은 편</span> — ${esc(Counsel.ELEMENT_PSY[a.el].lack)}</p>`;
      }
    }
    $('#element-comment').innerHTML = html;
  }

  function renderDayMaster(chart) {
    const s = chart.pillars.day.stemInfo;
    const dm = Counsel.DAY_MASTERS[chart.dayStem];
    $('#dm-ganji').textContent = `일간 ${s.kor}${s.han} · ${E[s.el].kor}`;
    $('#daymaster-profile').innerHTML = `
      <div class="dm-header"><span class="dm-title">${esc(dm.title)}</span></div>
      <p class="dm-essence">${esc(dm.essence)}</p>
      <div class="dm-block"><h4>마음의 결</h4><p>${esc(dm.mind)}</p></div>
      <div class="dm-block"><h4>타고난 힘</h4><ul>${dm.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="dm-block"><h4>지치는 순간</h4><p>${esc(dm.stress)}</p></div>
      <div class="dm-care"><b>마음 처방 —</b> ${esc(dm.care)}</div>`;
  }

  function renderDaeun(chart, counsel, age, ageMonths) {
    const cur = counsel.currentDaeun;
    $('#daeun-timeline').innerHTML = chart.daeun.map(d => `
      <div class="daeun-item ${cur && d.startMonths === cur.startMonths ? 'current' : ''}">
        <div class="age">${fmtAgeM(d.startMonths)}~</div>
        <div class="gz">${d.stemInfo.han}<br>${d.branchInfo.han}</div>
        <div class="sip">${esc(d.stemSip)} · ${esc(d.branchSip)}</div>
      </div>`).join('');

    const stage = Counsel.lifeStage(age);
    let html = `<div class="stage">지금 나이 만 ${age}세 — ${esc(stage.name)} · ${esc(stage.msg)}</div>`;
    if (cur && counsel.currentDaeunMsg) {
      const cm = counsel.currentDaeunMsg;
      html = `<h3>지금의 계절 · ${cur.stemInfo.kor}${cur.branchInfo.kor} 대운 「${esc(cm.theme)}」</h3>` + html;
      html += `<p>${esc(cm.msg)}</p>`;
    } else if (counsel.currentDaeunStatus === 'before') {
      const dm2 = chart.meta;
      const startTxt = `${dm2.daeunAge}세${dm2.daeunMonths ? ' ' + dm2.daeunMonths + '개월' : ''}`;
      html = `<h3>첫 대운을 기다리는 시기</h3>` + html;
      html += `<p>첫 대운은 약 ${esc(startTxt)} 무렵 시작돼요. 아직은 타고난 기질이 가장 순수하게 자라는 시기입니다.</p>`;
    } else {
      html = `<h3>계절 너머의 시기</h3>` + html;
      html += `<p>흐름표의 대운 구간을 이미 지나오셨어요. 이제는 운의 계절보다, 지나온 계절들에서 길어 올린 지혜가 삶의 중심이 됩니다.</p>`;
    }
    // 대운 경계 안내 — 개월 단위로 남은 기간 계산
    if (cur) {
      const monthsLeft = cur.endMonths - ageMonths + 1;
      if (monthsLeft > 0 && monthsLeft <= 24) {
        const yl = Math.floor(monthsLeft / 12), ml = monthsLeft % 12;
        const leftTxt = yl ? `${yl}년${ml ? ' ' + ml + '개월' : ''}` : `${ml}개월`;
        html += `<p style="margin-top:10px;color:var(--text-dim);font-size:13.5px;">약 ${esc(leftTxt)} 뒤 다음 계절로 넘어갑니다. 계절이 바뀌기 전, 지금 계절의 숙제를 정리해 보기 좋은 때예요.</p>`;
      }
    }
    $('#daeun-counsel').innerHTML = html;
  }

  function renderConcerns(counsel) {
    const tabs = $('#concern-tabs');
    const body = $('#concern-body');
    const show = (key) => { body.textContent = counsel.cards[key].body; };
    tabs.querySelectorAll('.tab').forEach(btn => {
      btn.onclick = () => {
        tabs.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        show(btn.dataset.tab);
      };
    });
    tabs.querySelector('.tab').classList.add('active');
    show('mind');
  }
})();
