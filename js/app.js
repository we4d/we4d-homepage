/* ============================================================
   WE4D 홈페이지 — 동작 스크립트
   ------------------------------------------------------------
   보통은 이 파일을 건드릴 필요가 없습니다. 내용 수정은 js/content.js 에서.
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* 관리 페이지(admin.html) 미리보기: index.html?preview=draft 로 열면 브라우저에 임시 저장된 초안을 대신 보여줌 */
const isPreview = /preview=draft/.test(location.search);
(function () {
  if (!isPreview) return;
  let draft = null; try { draft = JSON.parse(localStorage.getItem('we4d_draft') || 'null'); } catch (_) {}
  if (!draft) return;
  const replace = (target, src) => { if (Array.isArray(target)) { target.length = 0; target.push(...src); } else { Object.keys(target).forEach(k => delete target[k]); Object.assign(target, src); } };
  const G = { SITE, DIRECTOR, STEPS, INST_CATS, INSTRUCTORS, LESSONS, NOTICES, EVENTS, HOLIDAYS, FAQ, AGENCIES };
  if (typeof POPUPS !== 'undefined') G.POPUPS = POPUPS;
  Object.keys(G).forEach(k => { if (draft[k] !== undefined) replace(G[k], draft[k]); });
  window.__draft = draft;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:999;background:#7C3AED;color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:700;box-shadow:0 10px 30px -10px rgba(0,0,0,.6)';
  bar.textContent = '미리보기 — 아직 저장되지 않은 초안입니다';
  document.body.appendChild(bar);
})();
const FIG = '<svg viewBox="0 0 200 240" fill="none" aria-hidden="true"><ellipse cx="100" cy="70" rx="42" ry="50" fill="#fff"/><path d="M20 240c0-60 36-96 80-96s80 36 80 96" fill="#fff"/></svg>';
const TODAY = SITE.demoToday ? new Date(SITE.demoToday + 'T00:00:00') : new Date();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const evClass = { agency: '', we4d: 'paper', online: 'blue', show: 'red' };
const evLabel = { agency: '방문 오디션', we4d: 'WE4D 행사', online: '온라인 · 마감', show: '공연 · 쇼케이스' };
const evBadge = { agency: 'badge-lilac', we4d: 'badge-ink', online: 'badge-blue', show: 'badge-red' };
const dateOf = e => new Date(e.y, e.m - 1, e.d);

/* ============================================================
   0. content.js 의 값을 화면에 채우기  (data-site="키" 요소)
   ============================================================ */
function get(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
$$('[data-site]').forEach(el => { const v = get(SITE, el.dataset.site); if (v != null) el.innerHTML = v; });
$$('[data-site-href]').forEach(el => { const v = get(SITE, el.dataset.siteHref); if (v) el.href = v; });
$$('[data-dir]').forEach(el => { const v = get(DIRECTOR, el.dataset.dir); if (v != null) el.innerHTML = v; });

/* 글씨 크기 설정 (content.js → SITE.design) → CSS 변수 */
(function () {
  const d = SITE.design || {};
  const map = { heroTitle: 'hero', heroAccent: 'hero-accent', sectionTitle: 'h2', sectionLabel: 'label', pillarTitle: 'pillar', cardTitle: 'card', lead: 'lead', body: 'body' };
  Object.keys(map).forEach(k => document.documentElement.style.setProperty('--sc-' + map[k], String((Number(d[k]) || 100) / 100)));
})();

/* 히어로 */
(function () {
  const v = $('#heroVideo');
  document.documentElement.style.setProperty('--hero-tint', SITE.hero.tint || 'transparent');
  // 영상 밝기(100 = 원본) · 어둡게 정도(0 = 그라데이션 없음, 100 = 최대) — 관리자 페이지 슬라이더
  document.documentElement.style.setProperty('--hero-bright', String((Number(SITE.hero.brightness) || 105) / 100));
  document.documentElement.style.setProperty('--hero-shade', String((SITE.hero.shade == null ? 100 : Number(SITE.hero.shade)) / 100));
  if (SITE.hero.ctaColor) document.documentElement.style.setProperty('--hero-cta', SITE.hero.ctaColor);
  if (SITE.hero.ctaText) document.documentElement.style.setProperty('--hero-cta-text', SITE.hero.ctaText);
  if (SITE.logoSize) document.documentElement.style.setProperty('--logo-h', SITE.logoSize + 'px');   // 상단 메뉴 로고 높이
  if (SITE.taglineSize) document.documentElement.style.setProperty('--tagline-fs', SITE.taglineSize + 'px');   // 로고 옆 글씨 크기
  // 글씨 색 (관리자 페이지 · 비우면 기본색)
  Object.entries(SITE.colors || {}).forEach(([k, c]) => { if (c) { document.documentElement.style.setProperty('--c-' + k, c); document.documentElement.setAttribute('data-c-' + k, '1'); } });
  if (SITE.hero.video) {
    v.src = SITE.hero.video;
    if (SITE.hero.poster) v.poster = SITE.hero.poster;
    v.addEventListener('loadeddata', () => v.classList.add('ready'));
    v.addEventListener('error', () => v.remove());   // 영상 파일이 없으면 애니메이션 배경만 표시
    v.play && v.play().catch(() => {});
  } else v.remove();
  $('#heroStats').innerHTML = SITE.hero.stats.map(s => `<div><b>${s.n}${s.unit ? `<small>${s.unit}</small>` : ''}</b><span>${s.label}</span></div>`).join('');
})();

/* 히어로 배경 캔버스 (영상이 없거나 로딩 전 · 블러 퍼플) */
(function () {
  const c = $('#heroCanvas'), ctx = c.getContext('2d'); let w, h, t = 0;
  const blobs = [{ x: .3, y: .4, r: .45, c: '124,58,237' }, { x: .75, y: .6, r: .4, c: '216,180,254' }, { x: .55, y: .2, r: .35, c: '59,130,246' }];
  function size() { w = c.width = innerWidth * .5; h = c.height = innerHeight * .5; }
  function draw() {
    t += .004; ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, w, h);
    blobs.forEach((b, i) => {
      const x = (b.x + Math.sin(t * 1.3 + i) * .12) * w, y = (b.y + Math.cos(t + i * 2) * .12) * h, r = b.r * Math.max(w, h);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${b.c},.55)`); g.addColorStop(1, `rgba(${b.c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(draw);
  }
  size(); draw(); addEventListener('resize', size);
})();

/* ============================================================
   1. 라우터 (해시 → 페이지 전환)
   ============================================================ */
const PAGES = ['home', 'about', 'instructors', 'lessons', 'events', 'location', 'consult'];
function route() {
  const raw = location.hash.replace('#', '') || 'home';
  const [pg, sub] = raw.split('/');
  const name = PAGES.includes(pg) ? pg : 'home';
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  $('#mnav').classList.remove('open'); $('#burger').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'lessons' && sub && LESSONS[sub]) setLessonTab(sub);
  if (name === 'instructors' && sub) setInstTab(sub);
  updateGnb();
}
window.addEventListener('hashchange', route);
function updateGnb() { const home = $('#page-home').classList.contains('active'); $('#gnb').classList.toggle('solid', !home || window.scrollY > 40); }
window.addEventListener('scroll', updateGnb, { passive: true });
$('#burger').addEventListener('click', e => { const o = $('#mnav').classList.toggle('open'); e.currentTarget.classList.toggle('open', o); e.currentTarget.setAttribute('aria-expanded', o); });

/* 히어로 영역 클릭 → 상담 */
const hero = $('#hero');
hero.addEventListener('click', e => { if (e.target.closest('a,button')) return; location.hash = 'consult'; });
hero.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = 'consult'; } });

/* ============================================================
   2. 홈 — 로고 티커 · 다가오는 오디션
   ============================================================ */
$('#ticker').innerHTML = [...AGENCIES, ...AGENCIES].map(a => a.img ? `<span class="lg" title="${a.n}"><img src="${a.img}" alt="${a.n}" style="height:${a.h || 36}px" loading="lazy"></span>` : `<span class="lg ${a.s || ''}">${a.n}</span>`).join('');
(function () {
  const up = EVENTS.filter(e => e.type === 'agency' && dateOf(e) >= TODAY).sort((a, b) => dateOf(a) - dateOf(b)).slice(0, 4);
  $('#upList').innerHTML = up.map(e => `<div class="up"><div class="date"><b>${String(e.d).padStart(2, '0')}</b>${MONTHS[e.m - 1].slice(0, 3).toUpperCase()} ${e.y}</div><div><h4>${e.t}</h4><p>${e.note}</p></div></div>`).join('');
})();

/* ============================================================
   3. WE4D — 원장 사진 · 약력 · SYSTEM 6단계
   ============================================================ */
(function () {
  const setPhoto = (el, src) => { if (!el || !src) return; const img = new Image(); img.onload = () => { el.style.backgroundImage = `url("${src}")`; el.classList.add('has-photo'); }; img.src = src; };
  setPhoto($('#dirPhoto'), DIRECTOR.photo);
  setPhoto($('#dirScene'), DIRECTOR.scenePhoto);   // (현장 사진 카드는 현재 사용 안 함)
  setPhoto($('#sysBanner'), (window.__draft && window.__draft.SYSTEM_BANNER !== undefined) ? window.__draft.SYSTEM_BANNER : SYSTEM_BANNER);
  $('#dirParas').innerHTML = DIRECTOR.paragraphs.map(p => `<p class="lead">${p}</p>`).join('');
  const careerEl = $('#dirCareer');
  if (DIRECTOR.career && DIRECTOR.career.length) careerEl.innerHTML = DIRECTOR.career.map(c => `<li><span>${c[0]}</span>${c[1]}</li>`).join('');
  else careerEl.remove();
  if ($('#parentsGrid') && SITE.parents) $('#parentsGrid').innerHTML = SITE.parents.items.map((p, i) => `<div class="pr"><span class="pr-n">0${i + 1}</span><h3>${p[0]}</h3><p>${p[1]}</p></div>`).join('');
  if ($('#fourdGrid') && SITE.fourd) $('#fourdGrid').innerHTML = SITE.fourd.items.map((d, i) => `<div class="fd"><span class="fd-n">0${i + 1}</span><div class="fd-en d">${d[0]}</div><div class="fd-kr">${d[1]}</div><p>${d[2]}</p></div>`).join('');
  $('#steps').innerHTML = STEPS.map((s, i) => `<li><span class="n">0${i + 1}</span><div><h3>${s.t}</h3><p>${s.d}</p></div><span class="tag">${s.tag}</span></li>`).join('');
})();

/* ============================================================
   4. 강사진 — 섹션별 캐러셀 + 프로필 모달
   ============================================================ */
const isLead = i => i.role && i.role !== 'TRAINER';   // TRAINER 외의 직책은 강조 색으로
function profPic(i, cls) { return `<div class="${cls}" style="--c1:${i.c1 || '#2B2338'};--c2:${i.c2 || '#0F0D14'}">${i.photo ? `<img src="${i.photo}" alt="${i.kr}">` : FIG}`; }
function profCard(i) {
  const idx = INSTRUCTORS.indexOf(i);
  return `<button class="prof" data-inst="${idx}">${profPic(i, 'pic')}<span class="badge ${isLead(i) ? 'badge-lilac' : 'badge-line'} role">${i.role}</span></div><div class="meta"><span class="d">${i.en}</span><b>${i.kr}</b><span class="${isLead(i) ? 'dir' : ''}">${i.title || i.role}</span></div></button>`;
}
$('#instTabs').innerHTML = INST_CATS.map((c, i) => `<button class="${i ? '' : 'on'}" data-cat="${c.k}" role="tab">${c.tab} <span class="mono" style="font-size:11px;opacity:.7">${c.en.toUpperCase()}</span></button>`).join('');
$('#instSections').innerHTML = INST_CATS.map(c => {
  const list = INSTRUCTORS.filter(i => i.cat === c.k);
  return `<div class="iset" id="inst-${c.k}">
  <div class="ihead"><div><h2 class="d">${c.en}</h2><p>${c.kr}</p></div><span class="cnt">${list.length} ${c.k === 'advisor' ? 'ADVISOR' : 'TRAINERS'}</span></div>
  <div class="carousel"><button class="arrow prev" aria-label="이전"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg></button><div class="igrid">${list.map(profCard).join('')}</div><button class="arrow next" aria-label="다음"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg></button></div>
</div>`;
}).join('');
$$('.carousel').forEach(c => {
  const g = $('.igrid', c), prev = $('.prev', c), next = $('.next', c);
  const step = () => g.firstElementChild.getBoundingClientRect().width + 22;
  const upd = () => { prev.disabled = g.scrollLeft <= 2; next.disabled = g.scrollLeft + g.clientWidth >= g.scrollWidth - 2; };
  prev.onclick = () => g.scrollBy({ left: -step(), behavior: 'smooth' }); next.onclick = () => g.scrollBy({ left: step(), behavior: 'smooth' });
  g.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
});
function setInstTab(cat) {
  if (!INST_CATS.some(c => c.k === cat)) cat = INST_CATS[0].k;
  $$('#instTabs button').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  $('#inst-' + cat).scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('#instTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setInstTab(b.dataset.cat); });
document.addEventListener('click', e => {
  const p = e.target.closest('[data-inst]'); if (!p) return;
  const i = INSTRUCTORS[+p.dataset.inst];
  const career = (i.career && i.career.length) ? i.career.map(c => { const m = c.match(/^(\S+)\s(.*)$/); return `<li><span>${m ? m[1] : ''}</span>${m ? m[2] : c}</li>`; }).join('') : '<li><span></span><span style="color:var(--mute)">소개 준비 중입니다.</span></li>';
  $('#instModalBody').innerHTML = `${profPic(i, 'pic')}</div><div class="body"><span class="badge ${isLead(i) ? 'badge-lilac' : 'badge-ink'}">${i.role}</span><div class="d">${i.en}</div><div class="kr">${i.kr}${i.title ? ` · ${i.title}` : ''}</div>${i.q ? `<p class="quote">${i.q}</p>` : ''}<h4>Career</h4><ul class="career">${career}</ul><h4>Focus</h4><p style="font-size:15px">${i.focus || '—'}</p></div>`;
  openModal('#instModal');
});

/* ============================================================
   5. 레슨 안내 — 탭 · 취미 칩
   ============================================================ */
function lessonCards(d) {
  return `<div class="lcards">
    <div class="lcard"><div class="head"><h3>레슨 단계</h3><span class="d">Steps</span></div><ol>${d.steps.map((s, i) => `<li><i>${i + 1}</i><div><b>${s[0]}</b><span>${s[1]}</span></div></li>`).join('')}</ol></div>
    <div class="lcard"><div class="head"><h3>주차별 교육 과정</h3><span class="d">Timeline</span></div><div class="weeks">${d.weeks.map(w => `<div class="week"><i>${w[0]}</i><div class="bar" style="--w:${w[2]}%"><span>${w[1]}</span></div></div>`).join('')}</div></div>
    <div class="lcard"><div class="head"><h3>수강 혜택</h3><span class="d">Benefits</span></div><ul>${d.perks.map(p => `<li>${p}</li>`).join('')}</ul></div>
  </div>`;
}
$('#lessonPanes').innerHTML = Object.entries(LESSONS).map(([k, d], idx) => {
  const subKeys = d.sub ? Object.keys(d.sub) : null;
  return `<div class="tabpane${idx === 0 ? ' on' : ''}" data-pane="${k}">
    <div class="lesson-intro"><div><span class="eyebrow">${d.en}</span><h2 class="kr-title">${d.kr}</h2><p class="lead">${d.lead}</p></div><div class="facts">${d.facts.map(f => `<div class="fact"><b>${f[0]}</b><span>${f[1]}</span></div>`).join('')}</div></div>
    ${subKeys ? `<div class="chips" data-chips>${subKeys.map((s, i) => `<button class="${i ? '' : 'on'}" data-sub="${s}">${s}</button>`).join('')}</div><div data-subpane>${lessonCards(d.sub[subKeys[0]])}</div>` : lessonCards(d)}
  </div>`;
}).join('');
function setLessonTab(k) { $$('#lessonTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === k)); $$('.tabpane').forEach(p => p.classList.toggle('on', p.dataset.pane === k)); }
$('#lessonTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLessonTab(b.dataset.tab); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sub]'); if (!b) return;
  const wrap = b.closest('.tabpane'); $$('[data-sub]', wrap).forEach(x => x.classList.toggle('on', x === b));
  $('[data-subpane]', wrap).innerHTML = lessonCards(LESSONS[wrap.dataset.pane].sub[b.dataset.sub]);
});

/* ============================================================
   6. 행사 안내 — 공지 · 달력
   ============================================================ */
$('#noticeList').innerHTML = NOTICES.map(n => `<li><span class="badge badge-${n[0]}">${n[1]}</span><span>${n[2]}</span><time>${n[3]}</time></li>`).join('');
let calY = TODAY.getFullYear(), calM = TODAY.getMonth();
function renderCal() {
  $('#calTitle').innerHTML = `<small>${MONTHS[calM].toUpperCase()}</small>${calY}년 ${calM + 1}월`;
  const first = new Date(calY, calM, 1).getDay(), dim = new Date(calY, calM + 1, 0).getDate(), prevDim = new Date(calY, calM, 0).getDate();
  const cells = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ d: prevDim - i, pad: true });
  for (let d = 1; d <= dim; d++) cells.push({ d, pad: false });
  while (cells.length % 7) cells.push({ d: cells.length - first - dim + 1, pad: true });
  $('#calDays').innerHTML = cells.map((c, i) => {
    const dow = i % 7, isT = !c.pad && calY === TODAY.getFullYear() && calM === TODAY.getMonth() && c.d === TODAY.getDate();
    const hol = c.pad ? null : HOLIDAYS[`${calY}-${calM + 1}-${c.d}`];
    const evs = c.pad ? [] : EVENTS.filter(e => e.y === calY && e.m === calM + 1 && e.d === c.d);
    return `<div class="day${c.pad ? ' pad' : ''}${dow === 0 ? ' sun' : ''}${dow === 6 ? ' sat' : ''}${isT ? ' today' : ''}${hol ? ' hol' : ''}"><div class="num">${isT ? `<em>${c.d}</em>` : c.d}</div>${hol ? `<div class="holname">${hol}</div>` : ''}${evs.map(e => `<button class="ev ${evClass[e.type]}" data-evkey="${e.y}-${e.m}-${e.d}-${e.t}">${e.t}<small>${e.time} · ${evLabel[e.type]}</small></button>`).join('')}</div>`;
  }).join('');
  $('#evDetail').classList.remove('on');
}
$('#calPrev').onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); };
$('#calNext').onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); };
$('#calToday').onclick = () => { calY = TODAY.getFullYear(); calM = TODAY.getMonth(); renderCal(); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-evkey]'); if (!b) return;
  const [y, m, d, ...t] = b.dataset.evkey.split('-'); const ev = EVENTS.find(x => x.y == y && x.m == m && x.d == d && x.t === t.join('-')); if (!ev) return;
  $('#evDetail').innerHTML = `<span class="badge ${evBadge[ev.type]}" style="justify-self:start">${evLabel[ev.type]}</span><h4>${ev.t} · ${ev.m}월 ${ev.d}일 ${ev.time}</h4><p>${ev.note}</p>`;
  $('#evDetail').classList.add('on'); $('#evDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
renderCal();

/* ============================================================
   7. 오시는 길 · 상담 사이드 (content.js 값)
   ============================================================ */
$('#transit').innerHTML = SITE.transit.map(t => `<li><span class="ln" style="background:${t[0]}">${t[1]}</span><span>${t[2]}</span></li>`).join('');
$('#hours').innerHTML = SITE.hours.map(h => `<span>${h[0]}</span><div>${h[1]}</div>`).join('') + `<span>TEL</span><div><a href="tel:${SITE.telLink}" style="font-weight:700">${SITE.tel}</a></div>`;
$('#faq').innerHTML = FAQ.map(f => `<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join('');

/* ============================================================
   8. 모달 · 폼
   ============================================================ */
let lastFocus = null;
function openModal(sel) { lastFocus = document.activeElement; $(sel).classList.add('on'); document.body.style.overflow = 'hidden'; const f = $('input,button.x', $(sel)); f && f.focus(); }
function closeModals() { $$('.modal.on').forEach(m => m.classList.remove('on')); document.body.style.overflow = ''; lastFocus && lastFocus.focus && lastFocus.focus(); }
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModals(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

/* 폼 유효성 검사 */
function validate(form) {
  let ok = true;
  $$('[required]', form).forEach(el => {
    let bad = false;
    if (el.type === 'radio') { bad = !form.querySelector(`[name="${el.name}"]:checked`); const wrap = el.closest('.opts'); wrap.style.outline = bad ? '2px solid #EF4444' : ''; wrap.style.outlineOffset = '4px'; wrap.style.borderRadius = '999px'; }
    else if (el.type === 'checkbox') { bad = !el.checked; el.closest('label').style.color = bad ? '#EF4444' : ''; }
    else { bad = !el.value.trim() || (el.type === 'url' && !/^https?:\/\//.test(el.value)); el.style.borderColor = bad ? '#EF4444' : ''; }
    if (bad) ok = false;
  });
  return ok;
}
/* 상담 신청 → 문자(SMS)로 원장 휴대폰에 전달 + (설정 시) 이메일 전송
   · 휴대폰에서 신청하면 문자 앱이 신청 내용이 채워진 채로 열립니다 → '보내기'만 누르면 됨
   · PC에서 신청하면 내용을 복사해 문자/카톡으로 보내도록 안내
   · SITE.formEndpoint(Formspree 등)를 넣으면 이메일로도 자동 전송 */
function formMessage(form) {
  const fd = new FormData(form);
  const fields = fd.getAll('field').join(', ');
  return [
    '[WE4D 상담 신청]',
    `이름: ${fd.get('name')}`,
    `연락처: ${fd.get('phone')}`,
    `연령대: ${fd.get('age')}`,
    `관심 포지션: ${fd.get('track') || '-'}`,
    fields ? `관심 분야: ${fields}` : null,
    `연락 희망: ${fd.get('time')}`,
    fd.get('msg') ? `문의: ${fd.get('msg')}` : null
  ].filter(Boolean).join('\n');
}
async function sendForm(kind, form) {
  if (SITE.formEndpoint && /^https?:\/\//.test(SITE.formEndpoint)) {   // 전송 서비스(Formspree 등) 주소일 때만
    try { await fetch(SITE.formEndpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } }); } catch (e) { console.warn('form endpoint error', e); }
  }
  return true;
}
/* 이메일 주소 (SITE.email 또는 formEndpoint 에 적힌 이메일) → '이메일로 보내기' 버튼 */
const ACADEMY_EMAIL = (SITE.email && SITE.email.includes('@')) ? SITE.email : (SITE.formEndpoint && /^[^@\s]+@[^@\s]+$/.test(SITE.formEndpoint) ? SITE.formEndpoint : '');
function mailLink(text) { return `mailto:${ACADEMY_EMAIL}?subject=${encodeURIComponent('[WE4D 상담 신청] ' + (text.match(/이름: (.*)/) || ['', ''])[1])}&body=${encodeURIComponent(text)}`; }
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function smsLink(text) {
  const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
  return `sms:${SITE.notifyPhone}${sep}body=${encodeURIComponent(text)}`;
}
$('#consultForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate(e.target)) { e.target.querySelector('[style*="EF4444"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const msg = formMessage(e.target);
  await sendForm('consult', e.target);
  const done = $('#consultDone');
  $('#doneMsg').textContent = msg;
  $('#doneLead').innerHTML = isMobile
    ? '아래 내용이 담긴 <b>문자 앱이 열립니다. \'보내기\'만 눌러 주세요.</b><br>문자 앱이 열리지 않으면 아래 버튼을 눌러 주세요.'
    : (ACADEMY_EMAIL
        ? '신청 내용이 정리되었습니다.<br><b>\'이메일로 보내기\'</b>를 누르면 메일 앱이 열립니다. 보내기만 눌러 주세요.'
        : '신청 내용이 정리되었습니다.<br><b>\'내용 복사\'</b>를 누른 뒤 아래 번호로 문자를 보내거나 네이버 톡톡으로 보내 주시면 바로 확인합니다.');
  $('#doneSms').href = smsLink(msg);
  $('#doneSms').style.display = isMobile ? '' : 'none';
  const mail = $('#doneMail');
  if (mail) { if (ACADEMY_EMAIL) { mail.href = mailLink(msg); mail.style.display = ''; mail.classList.toggle('btn-ink', !isMobile); mail.classList.toggle('btn-ghost', isMobile); } else mail.style.display = 'none'; }
  $('#doneCopy').onclick = async () => { try { await navigator.clipboard.writeText(msg); $('#doneCopy').textContent = '복사됨 ✓'; } catch (_) {} };
  e.target.style.display = 'none'; done.classList.add('on'); window.scrollTo({ top: 0, behavior: 'smooth' });
  if (isMobile) setTimeout(() => { location.href = smsLink(msg); }, 400);   // 휴대폰: 문자 앱 자동 열기
});
/* 플로팅 배너 */
$('#bubbleX').onclick = () => $('#bubble').remove();

/* ============================================================
   팝업창 (content.js → POPUPS) — 켜져 있고 기간 안이면 첫 방문 시 표시
   ============================================================ */
(function () {
  const list = (typeof POPUPS !== 'undefined' ? POPUPS : []).filter((p, i) => {
    if (!p || !p.on) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (p.from && new Date(p.from) > today) return false;
    if (p.until && new Date(p.until) < today) return false;
    const key = 'we4d_popup_hide_' + i;
    let hide = null; try { hide = localStorage.getItem(key); } catch (_) {}
    return isPreview || hide !== new Date().toDateString();
  });
  if (!list.length) return;
  const wrap = document.createElement('div'); wrap.className = 'popups'; wrap.id = 'popups';
  wrap.innerHTML = `<div class="popups-bg"></div><div class="popups-row">` + list.map(p => {
    const i = POPUPS.indexOf(p);
    const align = p.textAlign || 'center', pos = p.textPos || 'bottom';
    const txt = `<div class="pp-txt" style="text-align:${align};color:${p.textColor || '#fff'}">${p.title ? `<h3>${p.title}</h3>` : ''}${p.text ? `<p>${p.text}</p>` : ''}${p.link ? `<a class="btn btn-lilac btn-sm" href="${p.link}">${p.linkText || '자세히 보기'} <span class="arr">&gt;&gt;</span></a>` : ''}</div>`;
    const body = p.layout === 'overlay' && p.image
      ? `<div class="pp-overlay pos-${pos}" style="background-image:url('${p.image}')">${txt}</div>`
      : `${p.image ? `<img class="pp-img" src="${p.image}" alt="">` : ''}${txt}`;
    return `<div class="pp" style="--w:${p.width || 460}px;background:${p.bg || '#141218'}"><button class="pp-x" data-pp-close aria-label="닫기">×</button>${body}<div class="pp-foot"><label><input type="checkbox" data-pp-today="${i}"> 오늘 하루 보지 않기</label><button data-pp-close>닫기</button></div></div>`;
  }).join('') + `</div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => {
    const pp = e.target.closest('.pp');
    if (e.target.closest('[data-pp-close]') && pp) {
      const cb = pp.querySelector('[data-pp-today]'); if (cb && cb.checked) { try { localStorage.setItem('we4d_popup_hide_' + cb.dataset.ppToday, new Date().toDateString()); } catch (_) {} }
      pp.remove(); if (!wrap.querySelector('.pp')) wrap.remove();
    }
    if (e.target.classList.contains('popups-bg')) wrap.remove();
    if (e.target.closest('.pp a[href]')) wrap.remove();
  });
})();

/* ============================================================
   9. 화면의 "WE4D" 글자를 전부 로고 이미지로 교체
      (문자·alt·title 등 코드 안의 글자는 그대로 둠)
   ============================================================ */
function logoize(root = document.body) {
  const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'PRE', 'TITLE']);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeValue.includes('WE4D') && !skip.has(n.parentElement.tagName) && !n.parentElement.closest('.logo, .wm')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    const frag = document.createDocumentFragment();
    n.nodeValue.split(/(WE4D)/).forEach(part => {
      if (part === 'WE4D') { const s = document.createElement('span'); s.className = 'wm'; s.innerHTML = '<img src="assets/logo.png" alt="WE4D">'; frag.appendChild(s); }
      else if (part) frag.appendChild(document.createTextNode(part));
    });
    n.parentNode.replaceChild(frag, n);
  });
}
logoize();
new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) logoize(n); }))).observe(document.body, { childList: true, subtree: true });

route();
