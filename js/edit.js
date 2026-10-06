/* ============================================================
   WE4D 현장 편집 모드  (we4d.co.kr/admin  =  index.html?edit=1)
   ------------------------------------------------------------
   · 홈페이지를 그대로 보면서 글을 클릭해 바로 고칩니다.
   · 글을 클릭하면 옆에 도구창이 떠서 크기 · 색을 조절할 수 있습니다.
   · 사진 · 영상은 클릭하면 바로 교체됩니다.
   · 카드/항목 위에서 마우스 오른쪽 클릭 → 추가 · 복제 · 삭제 · 순서 이동.
   · [저장]을 누르면 GitHub 에 올라가고 약 1분 뒤 홈페이지에 반영됩니다.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 저장 대상 데이터 ---------- */
  const DATA = { SITE, DIRECTOR, STEPS, SYSTEM_BANNER, INST_CATS, INSTRUCTORS, LESSONS, NOTICES, EVENTS, HOLIDAYS, FAQ, AGENCIES };
  if (typeof POPUPS !== 'undefined') DATA.POPUPS = POPUPS;
  if (!SITE.texts) SITE.texts = {};
  if (!SITE.sizes) SITE.sizes = {};
  if (!SITE.widths) SITE.widths = {};
  if (!SITE.fonts) SITE.fonts = {};
  if (!SITE.colors) SITE.colors = {};
  if (!SITE.design) SITE.design = {};

  const GH_REPO = 'we4d/we4d-homepage', GH_BRANCH = 'main', API = 'https://api.github.com';
  let token = null, dirty = false;
  const pending = new Map();   // 새로 올릴 사진 (경로 → 파일)

  /* ---------- 작은 도우미 ---------- */
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const getAt = p => p.reduce((o, k) => (o == null ? o : o[k]), DATA);
  // 중간에 없는 목록/묶음은 만들어 가며 값을 넣음 (예: 아직 약력이 없는 강사)
  const setAt = (p, v) => { let o = DATA; for (let i = 0; i < p.length - 1; i++) { if (o[p[i]] == null) o[p[i]] = typeof p[i + 1] === 'number' ? [] : {}; o = o[p[i]]; } o[p[p.length - 1]] = v; };
  function toast(msg, isErr) {
    let t = document.querySelector('.ed-toast'); if (!t) { t = el('div', 'ed-toast'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.add('on');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), isErr ? 4500 : 2600);
  }
  // 글 위치를 가리키는 고정 주소 (구조가 바뀌면 자동으로 무시됨)
  function selectorOf(node) {
    const parts = [];
    for (let e = node; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) {
      if (e.id) { parts.unshift('#' + e.id); break; }
      const p = e.parentElement; if (!p) break;
      const same = [...p.children].filter(c => c.tagName === e.tagName);
      parts.unshift(e.tagName.toLowerCase() + (same.length > 1 ? `:nth-of-type(${same.indexOf(e) + 1})` : ''));
    }
    return parts.join(' > ');
  }

  /* ---------- 어떤 글이 어떤 크기·색 설정에 묶여 있는지 ---------- */
  const STYLE_OF = [
    ['.hero h1', 'heroTitle', 'hero', '첫 화면 큰 제목'],
    ['.hero-accent', 'heroAccent', 'heroAccent', '제목 위 문구'],
    ['.hero-sub', 'heroEyebrow', 'heroEyebrow', '제목 아래 글씨'],
    ['.logo small', 'taglineSize', 'tagline', '로고 아래 글씨'],
    ['.page-hero .d-xl', null, 'sectionTitle', '페이지 제목'],
    ['.kr-title', 'sectionTitle', 'sectionTitle', '한글 제목'],
    ['.d-lg', 'sectionTitle', 'sectionTitle', '섹션 영문 제목'],
    ['.pillar .d', 'pillarTitle', 'pillarTitle', '오디션 · 입시 · 취미'],
    ['.eyebrow', 'sectionLabel', 'sectionLabel', '작은 라벨'],
    ['.lead', 'lead', 'lead', '소개 문장'],
    ['.card h3', 'cardTitle', 'cardTitle', '카드 제목'],
    ['.pr h3', 'cardTitle', 'cardTitle', '카드 제목'],
    ['.fd-kr', 'cardTitle', 'cardTitle', '카드 제목'],
    ['.pillar h3', 'cardTitle', 'cardTitle', '카드 제목']
  ];
  function styleInfoFor(node) {
    // 페이지 제목은 그 페이지 배너 설정(ts)에 묶임
    const bn = node.matches('.page-hero .d-xl') && node.closest('[data-banner]');
    if (bn) return { size: null, color: 'sectionTitle', name: '페이지 제목', banner: bn.dataset.banner, bnNode: bn };
    for (const [sel, size, color, name] of STYLE_OF) if (node.matches(sel)) return { size, color, name };
    return { size: 'body', color: 'body', name: '본문' };
  }

  /* ---------- 편집 가능한 요소 표시 ---------- */
  const SKIP = 'script,style,svg,canvas,video,select,input,textarea,.ed-bar,.ed-tool,.ed-menu,.ed-gate,.wm,.lang-sel,.ed-toast';
  function markEditable() {
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,span,b,small,time,summary,div,a,button').forEach(n => {
      if (n.closest(SKIP) || n.dataset.ed) return;
      // 자식 요소 없이 글자만 있는 것만 편집 대상으로
      const hasText = [...n.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim());
      const onlyText = [...n.children].every(c => c.classList.contains('wm') || c.classList.contains('arr') || c.tagName === 'B' || c.tagName === 'EM' || c.tagName === 'SMALL' || c.tagName === 'BR');
      if (!hasText || !onlyText) return;
      if (n.matches('.ticker-track *')) return;
      n.dataset.ed = '1';
    });
    document.querySelectorAll('img').forEach(img => { if (!img.closest('.ed-bar,.ed-tool,.ed-menu,.ed-gate,.wm')) img.dataset.edImg = '1'; });
    document.querySelectorAll('[data-bg]').forEach(n => { n.dataset.edImg = 'bg'; });
    const hv = document.getElementById('heroVideo'); if (hv) hv.dataset.edImg = 'video';
    document.querySelectorAll('[data-banner]').forEach(s => { s.dataset.edImg = 'banner'; });
  }

  /* ---------- 글 편집 ---------- */
  let active = null, tool = null;
  /* ---------- 글상자 폭 손잡이 (오른쪽 세로 막대를 끌면 폭이 바뀜) ---------- */
  let wh = null, whTarget = null;
  const placeHandle = () => {
    if (!wh || !whTarget) return;
    const r = whTarget.getBoundingClientRect();
    wh.style.top = (window.scrollY + r.top) + 'px';
    wh.style.left = (window.scrollX + r.right - 6) + 'px';
    wh.style.height = Math.max(24, r.height) + 'px';
  };
  function hideHandle() {
    if (wh) { wh.remove(); wh = null; }
    whTarget = null;
    removeEventListener('scroll', placeHandle, true); removeEventListener('resize', placeHandle);
  }
  function showHandle(node) {
    hideHandle();
    wh = el('div', 'ed-wh'); wh.title = '끌어서 글상자 폭 조절';
    document.body.appendChild(wh); whTarget = node; placeHandle();
    addEventListener('scroll', placeHandle, true); addEventListener('resize', placeHandle);
    wh.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      wh.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w0 = node.getBoundingClientRect().width;
      const mv = ev => {
        const w = Math.max(90, Math.round(w0 + (ev.clientX - x0)));
        node.style.width = w + 'px'; node.style.maxWidth = w + 'px'; placeHandle();
      };
      const up = () => { wh.removeEventListener('pointermove', mv); wh.removeEventListener('pointerup', up); keepWidth(node); };
      wh.addEventListener('pointermove', mv); wh.addEventListener('pointerup', up);
    });
  }
  // 바뀐 폭을 저장 (max-width 로 두어 좁은 화면에서는 자동으로 줄어들게)
  function keepWidth(node) {
    if (!node || !node.style.maxWidth) return;
    const w = Math.round(parseFloat(node.style.maxWidth));
    if (!w) return;
    SITE.widths[selectorOf(node)] = w;
    node.style.width = '';
    dirty = true; updateBar();
  }
  function closeTool() {
    if (tool) { tool.remove(); tool = null; }
    if (active) {
      keepWidth(active); hideHandle();
      active.classList.remove('ed-active', 'ed-resize');
      active.style.width = '';
      active.removeAttribute('contenteditable'); active = null;
    }
  }

  function startEdit(node, ev) {
    if (active === node) return;
    closeTool();
    active = node; node.classList.add('ed-active');
    node.setAttribute('contenteditable', 'true');
    // 덩어리(문단·제목)면 오른쪽에 손잡이를 달아 글상자 폭을 끌어서 조절
    const disp = getComputedStyle(node).display;
    if (/^(block|flex|grid|list-item|table-cell)$/.test(disp)) { node.classList.add('ed-resize'); showHandle(node); }
    node.focus();
    // 엔터는 줄바꿈(<br>) 으로, 붙여넣기는 글자만 — 지저분한 태그가 안 생기게
    node.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); }
      if (e.key === 'Escape') { e.preventDefault(); node.blur(); closeTool(); }
    });
    node.addEventListener('paste', function onPaste(e) {
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, txt);
    });
    const before = node.innerHTML;
    node.addEventListener('blur', function onBlur() {
      node.removeEventListener('blur', onBlur);
      if (node.innerHTML === before) return;
      saveText(node, node.innerHTML.trim());
    });
    openTool(node);
  }

  // 브라우저가 엔터·붙여넣기 때 넣는 <div> · &nbsp; · style 을 깔끔한 <br> 로 정리
  function cleanHTML(h) {
    return h
      .replace(/<div><br\s*\/?><\/div>/gi, '<br>')
      .replace(/<\/div>\s*<div>/gi, '<br>')
      .replace(/<div>/gi, '<br>').replace(/<\/div>/gi, '')
      .replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '')
      .replace(/ style="[^"]*"/gi, '')
      .replace(/ (data-ed|data-ed-img|data-p|data-item|data-bg|data-prefix|contenteditable)="[^"]*"/gi, '')   // 편집용 표시가 글에 섞이지 않게
      .replace(/&nbsp;/g, ' ')
      .replace(/(<br\s*\/?>\s*)+$/i, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function saveText(node, html) {
    html = cleanHTML(html);
    if (node.innerHTML !== html) node.innerHTML = html;
    const p = node.dataset.p ? JSON.parse(node.dataset.p) : null;
    if (node.dataset.prefix) html = (node.dataset.prefix + ' ' + html).trim();   // 연도 등 앞부분을 붙여서 저장
    if (p) setAt(p, html);
    else if (node.dataset.site) { const path = ['SITE'].concat(node.dataset.site.split('.')); setAt(path, html); }
    else if (node.dataset.dir) setAt(['DIRECTOR', node.dataset.dir], html);
    else SITE.texts[selectorOf(node)] = html;
    dirty = true; updateBar();
  }

  // 페이지 배너: 제목 크기 · 배너 높이 · 어둡게
  const BN = [['bh', '배너 높이', 20, 90, 2, 46, 'vh'], ['dim', '어둡게', 0, 90, 5, 60, '%']];
  function bannerRows(key) {
    const b = (SITE.banners && SITE.banners[key]) || {};
    return BN.map(([k, label, min, max, step, def, unit]) =>
      `<div class="row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${b[k] == null ? def : b[k]}" data-bn="${k}"><b data-bnout="${k}">${b[k] == null ? def : b[k]}${unit}</b></div>`).join('');
  }
  function wireBanner(t, key, bnNode) {
    t.querySelectorAll('[data-bn]').forEach(r => r.addEventListener('input', () => {
      const k = r.dataset.bn, v = Number(r.value), row = BN.find(x => x[0] === k);
      SITE.banners[key][k] = v;
      t.querySelector(`[data-bnout="${k}"]`).textContent = v + row[6];
      if (k === 'ts') bnNode.style.setProperty('--bn-ts', String(v / 100));
      if (k === 'bh') bnNode.style.setProperty('--bn-h', v + 'vh');
      if (k === 'dim') bnNode.style.setProperty('--bn-dim', String(v / 100));
      dirty = true; updateBar();
    }));
  }

  // 고를 수 있는 글씨체 (실제 글꼴은 app.js 의 FONT_STACKS)
  const FONTS = [['', '기본'], ['gothic', '고딕 (기본 본문)'], ['dodum', '고운돋움 (부드러운 고딕)'], ['myeongjo', '명조 (나눔명조)'], ['black', '굵은 제목 (블랙한산스)'], ['pen', '손글씨 (나눔펜)'], ['archivo', '영문 대문자 (Archivo)'], ['mono', '라벨·숫자 (모노)']];

  // 클릭한 글자 하나의 크기 (SITE.sizes) — 원래 크기의 몇 % 인지로 저장
  function baseFontSize(node) {
    const keep = node.style.fontSize; node.style.fontSize = '';
    const b = parseFloat(getComputedStyle(node).fontSize) || 16;
    node.style.fontSize = keep; return b;
  }

  function openTool(node) {
    const info = styleInfoFor(node);
    const sel = selectorOf(node);
    const pct = Number(SITE.sizes[sel]) || 100;
    const base = baseFontSize(node);
    const t = el('div', 'ed-tool');
    const colorVal = info.color ? (SITE.colors[info.color] || '') : '';
    const canWide = node.classList.contains('ed-resize');
    t.innerHTML =
      `<h6>${info.name}</h6>` +
      `<div class="row"><span>크기</span><input type="range" min="50" max="250" step="5" value="${pct}" data-k="size"><b data-out>${pct}%</b></div>` +
      (info.color ? `<div class="row"><span>색</span><input type="color" value="${/^#[0-9a-f]{6}$/i.test(colorVal) ? colorVal : '#ffffff'}" data-k="color"><button class="mini" data-k="colorReset">기본색</button></div>` : '') +
      `<div class="row"><span>글씨체</span><select data-k="font">${FONTS.map(([k, label]) => `<option value="${k}"${(SITE.fonts[sel] || '') === k ? ' selected' : ''}>${label}</option>`).join('')}</select><span></span></div>` +
      (canWide ? `<div class="row"><span>글상자</span><small class="note" style="margin:0">오른쪽 보라색 막대를 끌어 폭 조절</small><button class="mini" data-k="wreset">원래대로</button></div>` : '') +
      (info.banner ? bannerRows(info.banner) : '') +
      `<div class="note">크기 · 글씨체 · 글상자 폭은 <b>클릭한 글자만</b> 바뀝니다. 색은 같은 종류의 글이 함께 바뀝니다.</div>`;
    document.body.appendChild(t);
    const r = node.getBoundingClientRect();
    t.style.top = (window.scrollY + r.bottom + 10) + 'px';
    t.style.left = Math.max(12, Math.min(window.scrollX + r.left, window.scrollX + innerWidth - 280)) + 'px';
    // 도구창 빈 곳을 눌러도 글 편집이 풀리지 않게. 단, 막대·색·버튼은 그대로 눌리게 둔다
    t.addEventListener('mousedown', e => { if (!e.target.closest('input,button,select,textarea,label')) e.preventDefault(); });
    const range = t.querySelector('[data-k=size]');
    if (range) range.addEventListener('input', () => {
      const v = Number(range.value);
      if (v === 100) { delete SITE.sizes[sel]; node.style.fontSize = ''; }
      else { SITE.sizes[sel] = v; node.style.fontSize = (base * v / 100).toFixed(1) + 'px'; }
      t.querySelector('[data-out]').textContent = v + '%';
      dirty = true; updateBar();
    });
    const fsel = t.querySelector('[data-k=font]');
    if (fsel) fsel.addEventListener('change', () => {
      const k = fsel.value;
      if (k) { SITE.fonts[sel] = k; node.style.fontFamily = (window.FONT_STACKS || {})[k] || ''; }
      else { delete SITE.fonts[sel]; node.style.fontFamily = ''; }
      dirty = true; updateBar();
    });
    const wr = t.querySelector('[data-k=wreset]');
    if (wr) wr.addEventListener('click', () => {
      delete SITE.widths[sel]; node.style.width = ''; node.style.maxWidth = ''; placeHandle();
      dirty = true; updateBar();
    });
    const col = t.querySelector('[data-k=color]');
    if (col) col.addEventListener('input', () => { applyColor(info.color, col.value); dirty = true; updateBar(); });
    const reset = t.querySelector('[data-k=colorReset]');
    if (reset) reset.addEventListener('click', () => { applyColor(info.color, ''); dirty = true; updateBar(); });
    if (info.banner) { if (!SITE.banners[info.banner]) SITE.banners[info.banner] = {}; wireBanner(t, info.banner, info.bnNode); }
    tool = t;
  }
  function applyColor(key, val) {
    SITE.colors[key] = val;
    if (val) { document.documentElement.style.setProperty('--c-' + key, val); document.documentElement.setAttribute('data-c-' + key, '1'); }
    else { document.documentElement.style.removeProperty('--c-' + key); document.documentElement.removeAttribute('data-c-' + key); }
  }

  /* ---------- 사진 · 영상 교체 ---------- */
  const filePick = el('input'); filePick.type = 'file'; filePick.hidden = true; document.body.appendChild(filePick);
  let pickTarget = null;
  function askFile(target, accept) { pickTarget = target; filePick.accept = accept; filePick.value = ''; filePick.click(); }
  filePick.addEventListener('change', async () => {
    const f = filePick.files[0]; if (!f || !pickTarget) return;
    const isVideo = /^video\//.test(f.type);
    if (isVideo && f.size > 30 * 1024 * 1024) { toast('영상이 너무 큽니다 (30MB 이하 권장)', true); return; }
    let rel, file;
    if (pickTarget.kind === 'file') {           // 같은 파일 자리를 그대로 덮어쓰기 (로고 · 지도처럼 경로가 고정된 사진)
      rel = pickTarget.path;
      file = await shrink(f, /\.png$/i.test(rel) ? 'image/png' : 'image/jpeg');
    } else {
      file = isVideo ? f : await shrink(f);
      rel = (pickTarget.dir || 'assets/uploads') + '/' + file.name.replace(/[^\w.\-]+/g, '_').toLowerCase();
    }
    pending.set(rel, file);
    const url = URL.createObjectURL(file);
    if (pickTarget.kind === 'file') { document.querySelectorAll('img').forEach(x => { if (x.getAttribute('src') === rel) x.src = url; }); }
    else if (pickTarget.kind === 'bg') { setAt(pickTarget.path, rel); pickTarget.node.style.backgroundImage = `url("${url}")`; pickTarget.node.classList.add('has-photo'); }
    else if (pickTarget.kind === 'img') { setAt(pickTarget.path, rel); pickTarget.node.src = url; }
    else if (pickTarget.kind === 'video') { SITE.hero.video = rel; pickTarget.node.src = url; pickTarget.node.play && pickTarget.node.play().catch(() => {}); }
    else if (pickTarget.kind === 'banner') {
      const key = pickTarget.node.dataset.banner;
      SITE.banners[key].banner = rel;
      pickTarget.node.classList.add('has-banner');
      pickTarget.node.style.setProperty('--bn-img', `url('${url}')`);
      pickTarget.node.style.setProperty('--bn-h', (SITE.banners[key].bh || 46) + 'vh');
      pickTarget.node.style.setProperty('--bn-dim', String((SITE.banners[key].dim == null ? 60 : SITE.banners[key].dim) / 100));
    }
    dirty = true; updateBar(); toast('사진을 바꿨습니다 — [저장]을 누르면 반영됩니다');
  });
  function shrink(file, force) {
    return new Promise(res => {
      const img = new Image(); img.onload = () => {
        const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
        if (sc === 1 && file.size < 900 * 1024 && (!force || force === file.type)) return res(file);
        const c = el('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const type = force || (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
        c.toBlob(b => res(new File([b], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type })), type, 0.88);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- 사진 도구창 (사진 바꾸기 + 크기) ---------- */
  function openImgTool(node, pick, sz) {
    closeTool();
    const t = el('div', 'ed-tool');
    t.innerHTML = `<h6>${sz.name}</h6>` +
      `<div class="row"><span>크기</span><input type="range" min="${sz.min}" max="${sz.max}" step="1" value="${sz.get()}" data-k="isize"><b data-out>${sz.get()}px</b></div>` +
      `<button class="mini" data-k="pick">사진 바꾸기</button>` +
      `<div class="note">크기를 옮기면 바로 보입니다. [저장]을 눌러야 홈페이지에 반영됩니다.</div>`;
    document.body.appendChild(t);
    const r = node.getBoundingClientRect();
    t.style.top = (window.scrollY + r.bottom + 10) + 'px';
    t.style.left = Math.max(12, Math.min(window.scrollX + r.left, window.scrollX + innerWidth - 280)) + 'px';
    const range = t.querySelector('[data-k=isize]');
    range.addEventListener('input', () => { const v = Number(range.value); sz.set(v); t.querySelector('[data-out]').textContent = v + 'px'; dirty = true; updateBar(); });
    t.querySelector('[data-k=pick]').addEventListener('click', pick);
    tool = t;
  }

  /* ---------- 오른쪽 클릭: 항목 추가 · 삭제 ---------- */
  let menu = null;
  const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
  // 항목을 더하거나 지운 뒤 화면의 번호(주소)를 다시 매김
  function reindexList(listPath) {
    const pre = JSON.stringify(listPath).slice(0, -1) + ',';
    [...document.querySelectorAll('[data-item]')].filter(n => n.dataset.item.startsWith(pre)).forEach((n, i) => {
      const oldPre = JSON.stringify(JSON.parse(n.dataset.item));
      const nw = listPath.concat(i);
      n.dataset.item = JSON.stringify(nw);
      const num = n.querySelector('.pr-n,.fd-n'); if (num) num.textContent = String(i + 1).padStart(2, '0');
      n.querySelectorAll('[data-p]').forEach(c => {
        const p = JSON.parse(c.dataset.p);
        if (JSON.stringify(p.slice(0, listPath.length + 1)) === oldPre) c.dataset.p = JSON.stringify(nw.concat(p.slice(listPath.length + 1)));
      });
    });
  }
  function openMenu(x, y, item) {
    closeMenu();
    const path = JSON.parse(item.dataset.item), idx = path[path.length - 1], listPath = path.slice(0, -1);
    const m = el('div', 'ed-menu');
    m.innerHTML = `<button data-a="dup">이 항목 복제해서 추가</button><button data-a="up">위로 이동</button><button data-a="down">아래로 이동</button><hr><button class="danger" data-a="del">이 항목 삭제</button>`;
    document.body.appendChild(m); m.style.left = (x + window.scrollX) + 'px'; m.style.top = (y + window.scrollY) + 'px';
    m.addEventListener('click', e => {
      const a = e.target.dataset.a; if (!a) return;
      const arr = getAt(listPath); if (!Array.isArray(arr)) return;
      const prev = item.previousElementSibling, next = item.nextElementSibling;
      if (a === 'dup') { arr.splice(idx + 1, 0, JSON.parse(JSON.stringify(arr[idx]))); item.after(item.cloneNode(true)); }
      if (a === 'del') {
        if (arr.length < 2) { toast('마지막 하나는 지울 수 없습니다', true); closeMenu(); return; }
        if (!confirm('이 항목을 삭제할까요?')) { closeMenu(); return; }
        arr.splice(idx, 1); item.remove();
      }
      if (a === 'up' && idx > 0) { arr.splice(idx - 1, 0, arr.splice(idx, 1)[0]); if (prev) prev.before(item); }
      if (a === 'down' && idx < arr.length - 1) { arr.splice(idx + 1, 0, arr.splice(idx, 1)[0]); if (next) next.after(item); }
      reindexList(listPath);
      closeMenu(); dirty = true; updateBar();
    });
    menu = m;
  }

  /* ---------- 클릭 처리 ---------- */
  document.addEventListener('click', e => {
    if (e.target.closest('.ed-bar,.ed-tool,.ed-menu,.ed-gate')) return;
    closeMenu();
    const img = e.target.closest('[data-ed-img]');
    const txt = e.target.closest('[data-ed]');
    // 배너처럼 사진 위에 글이 얹힌 경우 — 글을 눌렀으면 글 편집이 먼저
    if (img && !(txt && img.contains(txt))) {
      e.preventDefault(); e.stopPropagation();
      if (img.dataset.edImg === 'video') askFile({ kind: 'video', node: img, dir: 'assets' }, 'video/*');
      else if (img.dataset.edImg === 'banner') askFile({ kind: 'banner', node: img, dir: 'assets/banner' }, 'image/*');
      else if (img.dataset.edImg === 'bg') askFile({ kind: 'bg', node: img, path: JSON.parse(img.dataset.bg), dir: 'assets' }, 'image/*');
      else {
        const p = img.dataset.p ? JSON.parse(img.dataset.p) : null;
        const pick = p
          ? () => askFile({ kind: 'img', node: img, path: p, dir: p[0] === 'INSTRUCTORS' ? 'assets/inst' : p[0] === 'AGENCIES' ? 'assets/logos' : 'assets' }, 'image/*')
          : () => askFile({ kind: 'file', node: img, path: img.getAttribute('src').replace(/[?#].*$/, '') }, 'image/*');
        if (img.closest('.logo')) openImgTool(img, pick, { name: 'WE4D 로고', min: 20, max: 90, get: () => SITE.logoSize || 44, set: v => { SITE.logoSize = v; document.documentElement.style.setProperty('--logo-h', v + 'px'); } });
        else if (p && p[0] === 'AGENCIES') openImgTool(img, pick, { name: '기획사 로고', min: 16, max: 90, get: () => AGENCIES[p[1]].h || 36, set: v => { AGENCIES[p[1]].h = v; document.querySelectorAll(`#ticker img[data-p='${img.dataset.p}']`).forEach(x => x.style.height = v + 'px'); } });
        else pick();
      }
      return;
    }
    const t = e.target.closest('[data-ed]');
    // 메뉴·버튼(링크)은 눌러서 이동할 수 있어야 하므로 두 번 클릭해야 글이 고쳐집니다
    if (t && e.target.closest('a[href],button')) { closeTool(); return; }
    if (t) { e.preventDefault(); e.stopPropagation(); startEdit(t, e); return; }
    closeTool();
  }, true);

  document.addEventListener('dblclick', e => {
    const t = e.target.closest('a[href],button');
    if (!t || t.closest('.ed-bar,.ed-tool,.ed-menu,.ed-gate')) return;
    const n = t.matches('[data-ed]') ? t : t.querySelector('[data-ed]') || e.target.closest('[data-ed]');
    if (n) { e.preventDefault(); e.stopPropagation(); startEdit(n, e); }
  }, true);

  document.addEventListener('contextmenu', e => {
    const item = e.target.closest('[data-item]');
    if (!item) return;
    e.preventDefault(); openMenu(e.clientX, e.clientY, item);
  });

  /* ---------- 저장 (GitHub) ---------- */
  async function gh(path, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(opt.headers || {}) } });
    if (!r.ok) {
      let why = '';
      try { const j = await r.json(); why = [j.message, ...(j.errors || []).map(e => e.message || `${e.field} ${e.code}`)].filter(Boolean).join(' / '); } catch (_) {}
      const e = new Error('GitHub ' + r.status + (why ? ': ' + why : '') + (r.status === 401 ? ' (토큰 확인 필요)' : ''));
      e.status = r.status; e.why = why;
      throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  const b64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  function buildContent() {
    const head = `/* ============================================================\n   WE4D 홈페이지 — 콘텐츠 설정 파일  (현장 편집에서 ${new Date().toLocaleString('ko-KR')} 저장)\n   ============================================================ */\n\n`;
    return head + Object.keys(DATA).map(k => `const ${k} = ${JSON.stringify(DATA[k], null, 2)};\n`).join('\n');
  }
  async function save(btn) {
    if (!token) { toast('내 컴퓨터 미리보기에서는 저장할 수 없습니다 (we4d.co.kr/admin 에서 저장하세요)', true); return; }
    const src = buildContent();
    try { new Function(src)(); } catch (err) { toast('내용에 오류가 있어 저장할 수 없습니다: ' + err.message, true); return; }
    btn.disabled = true;
    const changes = new Map(pending); changes.set('js/content.js', new Blob([src], { type: 'text/javascript' }));
    const blobs = new Map();   // 올린 파일은 다시 올리지 않게 기억
    // 올리는 도중 다른 사람이 먼저 저장하면(앞 저장과 부딪히면) 최신 내용 위에 한 번 더 시도
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        btn.textContent = attempt > 1 ? '다시 올리는 중…' : '올리는 중…';
        const ref = await gh(`/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`);
        const head = await gh(`/repos/${GH_REPO}/git/commits/${ref.object.sha}`);
        const tree = []; let n = 0;
        for (const [p, b] of changes) {
          btn.textContent = `올리는 중 ${++n}/${changes.size}`;
          if (!blobs.has(p)) {
            const blob = await gh(`/repos/${GH_REPO}/git/blobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: await b64(b), encoding: 'base64' }) });
            blobs.set(p, blob.sha);
          }
          tree.push({ path: p, mode: '100644', type: 'blob', sha: blobs.get(p) });
        }
        const nt = await gh(`/repos/${GH_REPO}/git/trees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
        const commit = await gh(`/repos/${GH_REPO}/git/commits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '현장 편집 (' + new Date().toLocaleString('ko-KR') + ')', tree: nt.sha, parents: [head.sha] }) });
        await gh(`/repos/${GH_REPO}/git/refs/heads/${GH_BRANCH}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sha: commit.sha }) });
        pending.clear(); dirty = false; updateBar();
        toast('저장했습니다 — 약 1분 뒤 홈페이지에 반영됩니다');
        break;
      } catch (err) {
        const retryable = err.status === 422 || err.status === 409;
        if (retryable && attempt < 3) { await new Promise(r => setTimeout(r, 1200 * attempt)); continue; }
        toast('저장 실패: ' + err.message + (retryable ? ' — 잠시 뒤 [저장]을 다시 눌러 주세요' : ''), true);
        break;
      }
    }
    btn.disabled = false; btn.textContent = '저장';
  }

  /* ---------- 위쪽 편집 바 ---------- */
  let bar, saveBtn, stateTxt;
  function updateBar() { if (stateTxt) stateTxt.textContent = dirty ? '● 저장하지 않은 수정이 있습니다' : '수정 사항 없음'; if (saveBtn) saveBtn.classList.toggle('on', dirty); }
  function buildBar() {
    bar = el('div', 'ed-bar');
    bar.innerHTML = `<b>WE4D 현장 편집</b><span class="st"></span><span class="sp"></span>
      <button class="ed-btn" data-a="form">표 형식 편집</button>
      <button class="ed-btn" data-a="view">홈페이지 보기</button>
      <button class="ed-btn on" data-a="save">저장</button>`;
    document.body.appendChild(bar);
    stateTxt = bar.querySelector('.st'); saveBtn = bar.querySelector('[data-a=save]');
    bar.addEventListener('click', e => {
      const a = e.target.dataset.a;
      if (a === 'save') save(e.target);
      if (a === 'view') { if (dirty && !confirm('저장하지 않은 수정이 있습니다. 나갈까요?')) return; location.href = '/'; }
      if (a === 'form') { if (dirty && !confirm('저장하지 않은 수정이 있습니다. 나갈까요?')) return; location.href = 'admin-form.html'; }
    });
    document.body.classList.add('ed-on');
    updateBar();
  }

  /* ---------- 잠금 (비밀번호 · GitHub 토큰) ---------- */
  const te = new TextEncoder(), td = new TextDecoder();
  async function key(pw, salt) { const k = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  async function seal(tok, pw) { const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pw, salt), te.encode(tok))); localStorage.setItem('we4d_gh', JSON.stringify({ salt: [...salt], iv: [...iv], ct: [...ct] })); }
  async function open_(pw) { try { const j = JSON.parse(localStorage.getItem('we4d_gh')); return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(j.iv) }, await key(pw, new Uint8Array(j.salt)), new Uint8Array(j.ct))); } catch (_) { return null; } }

  function gate() {
    const has = !!localStorage.getItem('we4d_gh');
    const g = el('div', 'ed-gate');
    g.innerHTML = `<form>
      <h2>${has ? '관리자 비밀번호' : '처음 설정'}</h2>
      ${has ? `<input type="password" id="edpw" placeholder="비밀번호" autofocus autocomplete="current-password">`
            : `<p>이 브라우저에서 처음 쓰는 설정입니다. GitHub 토큰을 붙여 넣고 앞으로 쓸 비밀번호를 정하세요. (토큰은 이 브라우저 안에 비밀번호로 잠가 보관됩니다)</p>
               <input type="text" id="edtok" placeholder="GitHub 토큰 (github_pat_ 로 시작)" autocomplete="off">
               <input type="password" id="edpw" placeholder="비밀번호 정하기" autocomplete="new-password">
               <input type="password" id="edpw2" placeholder="비밀번호 한 번 더" autocomplete="new-password">`}
      <button type="submit">${has ? '들어가기' : '설정하고 들어가기'}</button>
      ${/^(localhost|127\.)/.test(location.hostname) ? `<button type="button" id="edlocal" style="background:#eee">저장 없이 둘러보기 (내 컴퓨터)</button>` : ``}
      ${has ? `<a href="#" id="edreset" style="text-align:center;font-size:12px;color:#6B6577">비밀번호를 잊었어요 (토큰 다시 입력)</a>` : ''}
      <div class="err"></div></form>`;
    document.body.appendChild(g);
    const err = g.querySelector('.err');
    g.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault(); err.textContent = '';
      const pw = g.querySelector('#edpw').value;
      if (has) { const t = await open_(pw); if (!t) { err.textContent = '비밀번호가 맞지 않습니다.'; return; } token = t; }
      else {
        const tok = g.querySelector('#edtok').value.trim();
        if (!tok) { err.textContent = 'GitHub 토큰을 붙여 넣어 주세요.'; return; }
        if (pw.length < 4) { err.textContent = '비밀번호는 4자 이상으로 정해 주세요.'; return; }
        if (pw !== g.querySelector('#edpw2').value) { err.textContent = '비밀번호 두 개가 서로 다릅니다.'; return; }
        token = tok;
      }
      try { await gh(`/repos/${GH_REPO}`); if (!has) await seal(token, pw); g.remove(); start(); }
      catch (ex) { token = null; err.textContent = '토큰 확인 실패: ' + ex.message; }
    });
    const lb = g.querySelector('#edlocal');
    if (lb) lb.addEventListener('click', () => { token = null; g.remove(); start(); });
    const r = g.querySelector('#edreset');
    if (r) r.addEventListener('click', ev => { ev.preventDefault(); localStorage.removeItem('we4d_gh'); g.remove(); gate(); });
  }

  /* ---------- 시작 ---------- */
  function start() {
    buildBar();
    markEditable();
    // 화면이 다시 그려지면(탭 전환 등) 편집 표시도 다시 — 타이핑 중에는 건너뜀
    let mt = 0;
    new MutationObserver(() => { clearTimeout(mt); mt = setTimeout(() => { if (!active) markEditable(); }, 200); })
      .observe(document.body, { childList: true, subtree: true });
    window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    toast('글을 클릭하면 바로 고칩니다 · 메뉴·버튼 글씨는 두 번 클릭 · 사진은 클릭해서 교체 · 카드에서 오른쪽 클릭 → 추가/삭제');
  }
  gate();
})();
