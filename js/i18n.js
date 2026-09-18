/* ============================================================
   WE4D 홈페이지 — 다국어 (한국어 원문 → 영어 · 중국어 · 일본어)
   ------------------------------------------------------------
   ■ 원문은 content.js / index.html 의 한국어 그대로 두고, 화면에 보이는 글자만 바꿔 끼우는 방식입니다.
   ■ 한국어 문구를 관리 페이지에서 고치면 아래 사전의 왼쪽(한국어)도 같은 글로 고쳐야 번역이 붙습니다.
     사전에 없는 문장은 한국어로 그대로 보입니다.
   ■ 번역 사전은 js/i18n-data.js 에 있습니다 (이 파일은 동작만 담당 · 건드리지 않기)
   ============================================================ */
/* 숫자가 들어가는 문장 — 규칙으로 처리 */
const I18N_RULES = [
  [/^(\d{4})년 (\d{1,2})월$/, (m, L) => L === 'en' ? ['January','February','March','April','May','June','July','August','September','October','November','December'][+m[2]-1] + ' ' + m[1] : `${m[1]}年${m[2]}月`],
  [/^(.+) · (\d{1,2})월 (\d{1,2})일 (.*)$/, (m, L) => L === 'en' ? `${m[1]} · ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[2]-1]} ${m[3]} ${m[4]}` : `${m[1]} · ${m[2]}月${m[3]}日 ${m[4]}`]
];

/* ---- 적용 ---- */
(function () {
  const IDX = { en: 0, zh: 1, ja: 2 };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'TITLE']);
  let lang = 'ko';
  try { lang = localStorage.getItem('we4d_lang') || 'ko'; } catch (e) {}
  if (!I18N_LANGS[lang]) lang = 'ko';

  function tr(ko, L) {
    const key = ko.replace(/\s+/g, ' ').trim();
    if (!key) return null;
    const hit = I18N[key];
    if (hit) return hit[IDX[L]];
    for (const [re, fn] of I18N_RULES) { const m = key.match(re); if (m) { const t = fn(m, L); if (t && t !== key) return t; } }
    // "14:00 · 방문 오디션" 처럼 " · " 로 이어진 문장은 조각별로 번역
    if (key.includes(" · ")) { let hit2 = false; const parts = key.split(" · ").map(p => { const h = I18N[p]; if (h) { hit2 = true; return h[IDX[L]]; } return p; }); if (hit2) return parts.join(" · "); }
    return null;
  }
  function applyNode(n) {
    if (n.__ko == null) n.__ko = n.nodeValue;
    const ko = n.__ko;
    if (lang === 'ko') { if (n.nodeValue !== ko) n.nodeValue = ko; return; }
    const t = tr(ko, lang);
    if (t == null) { if (n.nodeValue !== ko) n.nodeValue = ko; return; }
    const lead = ko.match(/^\s*/)[0], tail = ko.match(/\s*$/)[0];
    const out = lead + t + tail;
    if (n.nodeValue !== out) n.nodeValue = out;
  }
  function apply(root = document.body) {
    if (root.nodeType === 3) { if (!SKIP.has(root.parentElement?.tagName)) applyNode(root); return; }
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => SKIP.has(n.parentElement.tagName) || n.parentElement.closest('.wm, .lang-sel') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while (n = w.nextNode()) applyNode(n);
    root.querySelectorAll('[placeholder]').forEach(el => {
      if (el.__ko == null) el.__ko = el.placeholder;
      const t = lang === 'ko' ? null : tr(el.__ko, lang);
      el.placeholder = t == null ? el.__ko : t;
    });
  }

  /* 번역 후 글이 칸을 넘치면(예: 일본어 オーディション) 한 줄에 맞게 글씨를 줄임 */
  function fitLines() {
    document.querySelectorAll(".pillar .d").forEach(el => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 20 && el.scrollWidth > el.clientWidth + 1; i++) { size *= 0.92; el.style.fontSize = size + "px"; }
    });
  }
  window.addEventListener("resize", fitLines); window.addEventListener("hashchange", () => setTimeout(fitLines, 50)); if (document.fonts) document.fonts.ready.then(fitLines);

  function setLang(L) {
    lang = I18N_LANGS[L] ? L : 'ko';
    try { localStorage.setItem('we4d_lang', lang); } catch (e) {}
    document.documentElement.lang = lang === 'ko' ? 'ko' : lang === 'zh' ? 'zh-CN' : lang;
    apply();
    fitLines();
    document.querySelectorAll('.lang-sel').forEach(s => s.value = lang);
  }

  /* 메뉴 오른쪽 언어 선택 */
  function makeSel() {
    const s = document.createElement('select');
    s.className = 'lang-sel'; s.setAttribute('aria-label', 'Language');
    s.innerHTML = Object.entries(I18N_LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    s.value = lang;
    s.addEventListener('change', () => setLang(s.value));
    return s;
  }
  const cta = document.querySelector('.gnb-cta');
  if (cta) cta.insertBefore(makeSel(), cta.firstChild);

  setLang(lang);
  new MutationObserver(muts => { if (lang === 'ko') return; muts.forEach(m => m.addedNodes.forEach(n => apply(n))); }).observe(document.body, { childList: true, subtree: true });
  window.we4dSetLang = setLang;
})();
