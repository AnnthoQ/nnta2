/* Panel de control (celular o laptop): vista previa, guion por paso, navegación, láminas y preguntas. */
(function () {
  const D = window.DECK;
  const N = D.slides.length;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PIN_KEY = 'nnta2:pin';
  const T0_KEY = 'nnta2:t0';
  const WHO = { R: 'Roy · Mantenimiento', J: 'Jhefferson · Operaciones', A: 'Ambos' };

  document.querySelectorAll('[data-i]').forEach((e) => { e.innerHTML = window.icon(e.dataset.i); });

  const view = Stage.mount($('preview'), { preview: true, pager: false });
  const ambient = document.querySelector('body > .ambient');
  let state = { slide: 1, step: 0 };
  let slideSince = Date.now();

  /* ---------- Guion en burbujas ---------- */
  function bubbles(note) {
    if (!note) return '<div class="bubble-row A"><div class="bubble">Sin guion para este paso.</div></div>';
    let last = '';
    return note.split('\n').map((line) => {
      const m = line.match(/^([RJA]):\s*(.*)$/);
      const w = m ? m[1] : 'A';
      const tag = w !== last ? `<span class="who-tag">${WHO[w]}</span>` : '';
      last = w;
      return `<div class="bubble-row ${w}">${tag}<div class="bubble">${esc(m ? m[2] : line)}</div></div>`;
    }).join('');
  }

  /* ---------- Pintar el estado ---------- */
  function render(st) {
    const prevSlide = state.slide;
    state = Nav.norm(st);
    const s = D.slides[state.slide - 1];
    if (state.slide !== prevSlide) slideSince = Date.now();
    view.show(state.slide, state.step);

    $('pos').textContent = `${state.slide} / ${N}`;
    $('num').textContent = state.slide;
    $('title').textContent = s.title;
    $('steps').innerHTML = s.steps
      ? Array.from({ length: s.steps }, (_, i) => `<i class="${i < state.step ? 'on' : ''} ${i === state.step - 1 ? 'cur' : ''}"></i>`).join('')
      : '';
    $('script').innerHTML = bubbles(s.notes[state.step]);

    const nx = Nav.next(state);
    if (Nav.isLast(state)) {
      $('nextLabel').textContent = 'Fin de la presentación';
      $('next').innerHTML = '';
    } else if (nx.slide !== state.slide) {
      $('nextLabel').textContent = `Luego: lámina ${nx.slide} · ${D.slides[nx.slide - 1].title}`;
      $('next').innerHTML = bubbles(D.slides[nx.slide - 1].notes[0]);
    } else {
      $('nextLabel').textContent = `Luego: paso ${nx.step} de ${s.steps}`;
      $('next').innerHTML = bubbles(s.notes[nx.step]);
    }

    $('prev').disabled = Nav.isFirst(state);
    $('nextBtn').disabled = Nav.isLast(state);
    $('tAll').disabled = state.step === s.steps;
    document.querySelectorAll('#slideList button').forEach((b, i) => b.classList.toggle('cur', i === state.slide - 1));
    (s.tint || []).forEach((c, i) => ambient.style.setProperty(`--c${i + 1}`, c));
    tick();
  }

  /* ---------- Cronómetro ---------- */
  const mmss = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  const getT0 = () => { try { return +localStorage.getItem(T0_KEY) || 0; } catch (e) { return 0; } };
  const setT0 = (v) => { try { v ? localStorage.setItem(T0_KEY, String(v)) : localStorage.removeItem(T0_KEY); } catch (e) { /* nada */ } };
  function tick() {
    const t0 = getT0();
    $('timer').textContent = t0 ? mmss(Date.now() - t0) : '00:00';
    const s = D.slides[state.slide - 1];
    $('sub').textContent = (s.steps ? `Paso ${state.step} de ${s.steps}` : 'Lámina sin pasos') + ` · ${mmss(Date.now() - slideSince)} en esta lámina`;
  }
  setInterval(tick, 1000);
  $('timer').addEventListener('click', () => {
    if (!getT0()) { setT0(Date.now()); tick(); return; }
    if (confirm('¿Reiniciar el cronómetro?')) { setT0(0); tick(); }
  });

  /* ---------- Avisos ---------- */
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function setStatus(s, why) {
    const map = {
      live: ['live', 'En vivo'],
      connecting: ['', 'Conectando…'],
      offline: ['', 'Sin conexión'],
      local: ['', 'Local'],
    };
    const [cls, label] = map[s] || ['', s];
    const color = s === 'offline' ? 'var(--red)' : s === 'local' ? 'var(--orange)' : '';
    $('status').innerHTML = `<span class="dot ${cls}" style="${color ? 'background:' + color : ''}"></span><span>${label}</span>`;
    if (s === 'local' && why === 'missing') toast('Modo local: aún no existe la tabla en Supabase', 4500);
    if (s === 'offline') toast('Sin conexión con el servidor. Reintentando…', 3500);
  }

  /* ---------- Sincronización ---------- */
  const sync = Sync.create({
    deckId: (window.NNTA2_CONFIG && NNTA2_CONFIG.deck) || D.id,
    onState: (st) => render(st),
    onStatus: setStatus,
    onError: (kind) => {
      if (kind === 'pin') {
        try { sessionStorage.removeItem(PIN_KEY); } catch (e) { /* nada */ }
        sync.pin = null;
        showGate('La clave no es válida. Escríbela otra vez.');
      } else {
        toast('No se pudo enviar el cambio. Revisa la conexión.', 3500);
      }
    },
  });

  function go(st) {
    if (sync.mode === 'live' && !sync.pin) { showGate(); return; }
    const n = Nav.norm(st);
    if (n.slide === state.slide && n.step === state.step) return;
    if (!getT0() && !(n.slide === 1 && n.step === 0)) setT0(Date.now());
    if (navigator.vibrate) navigator.vibrate(8);
    sync.set(n);
  }
  const next = () => go(Nav.next(state));
  const prev = () => go(Nav.prev(state));

  /* ---------- Clave ---------- */
  function showGate(msg = '') {
    $('pinErr').textContent = msg;
    $('gate').hidden = false;
    setTimeout(() => $('pin').focus(), 50);
  }
  $('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = $('pin').value.trim();
    if (!pin) return;
    $('pinErr').textContent = 'Verificando…';
    try {
      const ok = await sync.checkPin(pin);
      if (!ok) {
        $('pinErr').textContent = 'Clave incorrecta.';
        $('gateForm').classList.remove('shake'); void $('gateForm').offsetWidth; $('gateForm').classList.add('shake');
        return;
      }
      sync.pin = pin;
      try { sessionStorage.setItem(PIN_KEY, pin); } catch (err) { /* nada */ }
      $('pin').value = '';
      $('gate').hidden = true;
      toast('Listo: controlas la presentación');
    } catch (err) {
      $('pinErr').textContent = 'No se pudo verificar la clave (¿sin conexión?).';
    }
  });

  /* ---------- Hojas: láminas y preguntas ---------- */
  $('slideList').innerHTML = D.slides.map((s, i) =>
    `<button data-n="${i + 1}"><span class="n">${i + 1}</span><span class="t">${esc(s.title)}</span><span class="s">${s.steps ? s.steps + ' pasos' : ''}</span></button>`).join('');
  $('qaList').innerHTML = D.qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');

  function openSheet(id) {
    $('sheetBack').classList.add('open');
    $(id).classList.add('open');
  }
  function closeSheets() {
    $('sheetBack').classList.remove('open');
    document.querySelectorAll('.sheet.open').forEach((s) => s.classList.remove('open'));
  }
  $('sheetBack').addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  $('slideList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    go({ slide: +b.dataset.n, step: 0 });
    closeSheets();
  });

  /* ---------- Botones, gestos y teclado ---------- */
  $('nextBtn').addEventListener('click', next);
  $('prev').addEventListener('click', prev);
  $('tAll').addEventListener('click', () => go({ slide: state.slide, step: D.slides[state.slide - 1].steps }));
  $('tSlides').addEventListener('click', () => openSheet('sheetSlides'));
  $('tQA').addEventListener('click', () => openSheet('sheetQA'));
  $('tScreen').addEventListener('click', () => window.open('index.html' + (sync.mode === 'local' ? '?local' : ''), 'nnta2-proyector'));

  let sx = 0, sy = 0;
  const box = $('previewBox');
  box.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  box.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
  });

  document.addEventListener('keydown', (e) => {
    if (!$('gate').hidden || e.target.closest('input')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    if (e.key === 'Escape') closeSheets();
  });

  /* Mantener la pantalla encendida mientras se presenta */
  async function wake() { try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch (e) { /* no soportado */ } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  wake();

  /* ---------- Inicio ---------- */
  render(state);
  sync.start().then(() => {
    if (sync.mode !== 'live') return;
    let saved = null;
    try { saved = sessionStorage.getItem(PIN_KEY); } catch (e) { /* nada */ }
    if (saved) sync.pin = saved; else showGate();
  });
})();
