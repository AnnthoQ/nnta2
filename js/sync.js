/* Sincroniza {lámina, paso} entre el proyector y los paneles.
 *
 * En vivo (Supabase): el estado está en la tabla nnta2_state (solo lectura para el público). Solo cambia con la
 *   función nnta2_set, que exige la clave del panel. Todos se enteran por Realtime (postgres_changes).
 * Local (?local o sin tabla): BroadcastChannel + localStorage entre pestañas del mismo navegador.
 */
(function () {
  const C = window.NNTA2_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const same = (a, b) => a && b && a.slide === b.slide && a.step === b.step;
  const MISSING = /does not exist|could not find|schema cache|PGRST20[25]|42P01|42883/i;

  function create({ deckId, onState, onStatus, onError }) {
    const key = 'nnta2:' + deckId;
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('nnta2-' + deckId) : null;
    const api = { mode: 'local', state: { slide: 1, step: 0 }, pin: null };
    let sb = null, lastRemote = null, queued = null, writing = false, retries = 0;

    const status = (s, detail) => { api.status = s; onStatus && onStatus(s, detail); };
    const emit = (st, src) => { api.state = { slide: st.slide, step: st.step }; onState && onState(api.state, src); };
    const readLocal = () => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
    const writeLocal = (st) => { try { localStorage.setItem(key, JSON.stringify({ ...st, t: Date.now() })); } catch (e) { /* sin almacenamiento */ } };

    if (bc) bc.onmessage = (e) => { if (api.mode === 'local' && e.data && e.data.type === 'state') emit(e.data, 'local'); };
    window.addEventListener('storage', (e) => {
      if (api.mode !== 'local' || e.key !== key || !e.newValue) return;
      try { emit(JSON.parse(e.newValue), 'local'); } catch (err) { /* ignorar */ }
    });

    function goLocal(reason) {
      api.mode = 'local';
      status('local', reason);
      emit(readLocal() || { slide: 1, step: 0 }, 'init');
    }

    function remote(row) {
      const st = { slide: row.slide, step: row.step };
      if (same(lastRemote, st)) return;
      lastRemote = st;
      if (writing || queued) return; // este panel está enviando: su estado manda
      emit(st, 'remote');
    }

    async function fetchState() {
      try {
        const { data, error } = await sb.from('nnta2_state').select('slide,step').eq('id', deckId).maybeSingle();
        if (error) {
          if (MISSING.test(`${error.code} ${error.message}`)) return 'missing';
          status('offline', error.message);
          return 'error';
        }
        if (!data) return 'missing';
        if (api.status === 'offline') status('live');
        remote(data);
        return 'ok';
      } catch (e) {
        status('offline', e.message);
        return 'error';
      }
    }

    function subscribe() {
      sb.channel('nnta2:' + deckId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'nnta2_state', filter: 'id=eq.' + deckId },
          (p) => { if (p.new && p.new.slide) remote(p.new); })
        .subscribe((s) => {
          if (s === 'SUBSCRIBED') { status('live'); fetchState(); }
          else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') status('offline', s);
        });
    }

    function goLive() {
      api.mode = 'live';
      subscribe();
      setInterval(() => { if (!document.hidden) fetchState(); }, 12000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchState(); });
    }

    async function start() {
      if (params.has('local') || !C.supabaseUrl || !window.supabase) {
        goLocal(params.has('local') ? 'forced' : 'noconfig');
        return api;
      }
      status('connecting');
      sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false } });
      const r = await fetchState();
      if (r === 'missing') {
        goLocal('missing');
        // Si la tabla se crea con la página abierta, pasa sola a modo en vivo (sin recargar).
        const probe = setInterval(async () => {
          if (document.hidden || api.mode !== 'local') return;
          if (await fetchState() === 'ok') { clearInterval(probe); goLive(); }
        }, 15000);
        return api;
      }
      if (r === 'error') emit(readLocal() || api.state, 'init');
      goLive();
      return api;
    }

    async function flush() {
      writing = true;
      while (queued) {
        const st = queued;
        queued = null;
        const { data, error } = await sb.rpc('nnta2_set', { p_deck: deckId, p_pin: api.pin || '', p_slide: st.slide, p_step: st.step })
          .then((r) => r, (e) => ({ error: e }));
        if (error) {
          const msg = `${error.code || ''} ${error.message || error}`;
          if (/clave|pin|28P01|42501/i.test(msg)) { writing = false; onError && onError('pin', msg); return; }
          if (retries++ < 3) { if (!queued) queued = st; await new Promise((r) => setTimeout(r, 900)); continue; }
          writing = false; retries = 0; onError && onError('net', msg); return;
        }
        retries = 0;
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.slide) lastRemote = { slide: row.slide, step: row.step };
      }
      writing = false;
      if (api.status !== 'live') status('live');
    }

    /* Cambiar el estado para todos */
    function set(st) {
      emit(st, 'self');
      if (api.mode === 'local') {
        writeLocal(api.state);
        if (bc) bc.postMessage({ type: 'state', ...api.state });
        return;
      }
      queued = { ...api.state };
      if (!writing) flush();
    }

    /* Cambio desde el teclado del proyector: en vivo solo afecta a esta pantalla (respaldo si falla el celular) */
    function nudge(st) { if (api.mode === 'local') set(st); else emit(st, 'self'); }

    async function checkPin(pin) {
      if (api.mode === 'local') return true;
      const { data, error } = await sb.rpc('nnta2_check', { p_deck: deckId, p_pin: pin });
      if (error) throw error;
      return data === true;
    }

    Object.assign(api, { start, set, nudge, checkPin });
    return api;
  }

  window.Sync = { create };
})();
