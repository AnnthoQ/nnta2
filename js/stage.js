/* Dibuja las láminas en un escenario de 1920×1080 y muestra {lámina, paso}. Lo usan el proyector y la vista previa del panel. */
(function () {
  const D = window.DECK;
  const N = D.slides.length;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v | 0));
  /* Espacios que no deben partir la línea: «S/ 500 000», «36 h», «40 %» */
  /* Solo se toca el texto entre etiquetas, nunca los atributos ni los trazos de los íconos SVG. */
  const nbText = (t) => t.replace(/S\/ /g, 'S/&nbsp;').replace(/(\d) (?=\d{3}\b)/g, '$1&nbsp;')
    .replace(/(\d) (h|%)(?=[\s.,;:)»]|$)/g, '$1&nbsp;$2').replace(/≈ /g, '≈&nbsp;');
  const nb = (h) => h.replace(/>([^<]+)</g, (m, t) => '>' + nbText(t) + '<');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Navegación compartida: el paso siguiente/anterior cruza de lámina cuando hace falta. */
  const Nav = {
    norm(st) {
      const slide = clamp(st && st.slide || 1, 1, N);
      return { slide, step: clamp(st && st.step || 0, 0, D.slides[slide - 1].steps) };
    },
    next(st) {
      const { slide, step } = Nav.norm(st);
      if (step < D.slides[slide - 1].steps) return { slide, step: step + 1 };
      if (slide < N) return { slide: slide + 1, step: 0 };
      return { slide, step };
    },
    prev(st) {
      const { slide, step } = Nav.norm(st);
      if (step > 0) return { slide, step: step - 1 };
      if (slide > 1) return { slide: slide - 1, step: D.slides[slide - 2].steps };
      return { slide, step };
    },
    isFirst: (st) => st.slide === 1 && st.step === 0,
    isLast: (st) => st.slide === N && st.step === D.slides[N - 1].steps,
  };

  /* Animación de conteo (48 → 36 h) */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function runCount(el, instant) {
    const from = +el.dataset.from, to = +el.dataset.to, suf = el.dataset.suffix || '';
    if (instant) { el.textContent = to + suf; return; }
    const t0 = performance.now(), dur = 1300;
    el.textContent = from + suf;
    const tick = (now) => {
      if (!el.isConnected || el.dataset.run !== '1') return;
      const p = Math.min(1, (now - t0 - 250) / dur);
      el.textContent = Math.round(from + (to - from) * easeOut(Math.max(0, p))) + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function mount(root, opts = {}) {
    const { preview = false, pager = true } = opts;
    root.classList.add('viewport');
    if (preview) root.classList.add('preview');
    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.innerHTML = '<div class="ambient" aria-hidden="true"><i></i><i></i><i></i></div>' +
      D.slides.map((s, i) => `<section class="slide" data-n="${i + 1}" aria-label="${esc(s.title)}">${nb(s.html)}</section>`).join('') +
      (pager ? `<nav class="pager glass" aria-hidden="true">${D.slides.map(() => '<i></i>').join('')}</nav>` : '');
    root.appendChild(stage);

    const slides = [...stage.querySelectorAll('.slide')];
    const amb = stage.querySelector('.ambient');
    const dots = [...stage.querySelectorAll('.pager i')];

    const fit = () => {
      const w = root.clientWidth, h = root.clientHeight;
      if (w && h) stage.style.setProperty('--k', Math.min(w / 1920, h / 1080));
    };
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(root);
    window.addEventListener('resize', fit);
    fit();

    let cur = 0, curStep = 0;

    function apply(el, step, instant) {
      el.querySelectorAll('[data-step]').forEach((e) => e.classList.toggle('in', +e.dataset.step <= step));
      el.querySelectorAll('.count').forEach((c) => {
        const host = c.closest('[data-step]');
        const visible = !host || host.classList.contains('in');
        if (visible && c.dataset.run !== '1') { c.dataset.run = '1'; runCount(c, instant); }
        if (!visible) { c.dataset.run = '0'; c.textContent = c.dataset.from + (c.dataset.suffix || ''); }
      });
    }

    function show(slide, step) {
      const st = Nav.norm({ slide, step });
      const el = slides[st.slide - 1];
      if (st.slide !== cur) {
        const forward = st.slide > cur;
        const old = slides[cur - 1];
        if (old) { old.classList.toggle('back', forward); old.classList.remove('on'); }
        // La lámina que entra se prepara sin animación y luego aparece
        el.classList.add('instant');
        el.classList.toggle('back', !forward);
        apply(el, st.step, true);
        void el.offsetWidth;
        el.classList.remove('instant');
        el.classList.add('on');
        const t = D.slides[st.slide - 1].tint || [];
        ['--c1', '--c2', '--c3'].forEach((v, i) => t[i] && amb.style.setProperty(v, t[i]));
        dots.forEach((d, i) => { d.classList.toggle('on', i === st.slide - 1); d.classList.toggle('done', i < st.slide - 1); });
      } else if (st.step !== curStep) {
        apply(el, st.step, false);
      }
      cur = st.slide; curStep = st.step;
      return st;
    }

    /* Muestra todo sin animación (útil para miniaturas) */
    function snap(slide, step) { stage.classList.add('instant'); show(slide, step); void stage.offsetWidth; stage.classList.remove('instant'); }

    return { show, snap, fit, stage, get state() { return { slide: cur, step: curStep }; } };
  }

  window.Nav = Nav;
  window.Stage = { mount };
})();
