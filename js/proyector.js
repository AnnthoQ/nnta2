/* Pantalla del proyector: muestra lo que manda el panel. El teclado sirve de respaldo. */
(function () {
  const D = window.DECK;
  const view = Stage.mount(document.getElementById('screen'));
  const hint = document.getElementById('hint');
  let hintTimer = 0;

  function say(html, ms = 3500, tone = '') {
    hint.innerHTML = html;
    hint.className = 'hint capsule glass show ' + tone;
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(() => hint.classList.remove('show'), ms);
  }

  const sync = Sync.create({
    deckId: (window.NNTA2_CONFIG && NNTA2_CONFIG.deck) || D.id,
    onState: (st) => view.show(st.slide, st.step),
    onStatus: (s, why) => {
      if (s === 'live') say('<span class="dot live"></span>En vivo · controla desde el panel', 3000);
      else if (s === 'connecting') say('<span class="dot"></span>Conectando…', 0);
      else if (s === 'offline') say('<span class="dot" style="background:var(--red)"></span>Sin conexión · usa ← → del teclado', 6000, 'warn');
      else if (s === 'local') {
        const t = why === 'missing' ? 'Modo local: falta crear la tabla en Supabase' : 'Modo local';
        say(`<span class="dot" style="background:var(--orange)"></span>${t} · ← → para avanzar`, 5000);
      }
    },
  });
  view.show(1, 0);
  window.__nnta2 = { view, sync }; // para pruebas desde la consola
  sync.start();

  /* Teclado y control remoto de presentación (los clickers envían Re Pág / Av Pág) */
  const go = (st) => sync.nudge(Nav.norm(st));
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const st = view.state;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); go(Nav.next(st)); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); go(Nav.prev(st)); break;
      case 'Home': go({ slide: 1, step: 0 }); break;
      case 'End': go({ slide: D.slides.length, step: 0 }); break;
      case 'f': case 'F': toggleFull(); break;
      case 'b': case 'B': case '.': document.body.classList.toggle('blackout'); break;
      case 'a': case 'A': go({ slide: st.slide, step: D.slides[st.slide - 1].steps }); break;
      case '?': case 'h': case 'H':
        say('→ / Espacio: avanzar · ←: retroceder · F: pantalla completa · B: pantalla negra · A: mostrar todo', 6000); break;
    }
  });

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }
  document.addEventListener('dblclick', toggleFull);

  /* El cursor se oculta tras 2 s sin moverse */
  let cursorTimer = 0;
  document.addEventListener('mousemove', () => {
    document.body.classList.remove('nocursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('nocursor'), 2000);
  });
})();
