/* Contenido de la presentación: láminas, pasos y guion.
 *
 * Cada lámina tiene:
 *   title  → nombre corto (panel del celular)
 *   tint   → colores de las luces de fondo [c1, c2, c3]
 *   html   → contenido. Los elementos con data-step="n" aparecen en el paso n (el 0 es la lámina recién abierta).
 *            style="--d:120ms" retrasa la entrada de un elemento dentro del mismo paso.
 *   notes  → guion por paso (índice = número de paso). Cada línea empieza con R: (Roy), J: (Jhefferson) o A: (ambos).
 */
(function () {
  const I = (k, c) => window.icon(k, c);
  const tile = (k, color) => `<span class="tile" style="--tint:var(--${color})">${I(k)}</span>`;
  const hd = (eyebrow, title) =>
    `<header class="hd">${eyebrow ? `<span class="eyebrow glass">${eyebrow}</span>` : ''}<h2>${title}</h2></header>`;

  const slides = [
    // ------------------------------------------------------------------ 1
    {
      title: 'Portada', tint: ['#0A84FF', '#FF9F0A', '#5E5CE6'],
      html: `
      <div class="cover">
        <div class="cover-logo">${window.UTP_LOGO || ''}</div>
        <span class="eyebrow glass">Negociación y Narrativa · Tarea Académica 2</span>
        <h1>Parada de planta en la unidad minera <span class="grad">Santa Isabel</span></h1>
        <p class="lead">Caso 4 · Una negociación entre Operaciones y Mantenimiento</p>
        <div class="people">
          <div class="glass person" data-step="1">${tile('produccion', 'a')}<div><b>Quispe Soncco, Jhefferson Gheremy</b><span>Rol A · Gerente de Operaciones</span></div></div>
          <div class="glass person" data-step="1" style="--d:120ms">${tile('llave', 'b')}<div><b>Poma Aquino, Roy Anthony</b><span>Rol B · Gerente de Mantenimiento</span></div></div>
        </div>
        <p class="meta" data-step="1" style="--d:240ms">Sección 25181 · Docente: Ing. Alfredo César Canavire Valdivia · Grupo 13 · Arequipa, 2026</p>
      </div>`,
      notes: [
        'R: Buenas tardes. Somos el grupo 13 y les presentamos el caso 4: una parada de planta en la unidad minera Santa Isabel.',
        'R: Jhefferson Quispe asumió el rol de gerente de Operaciones y yo, Roy Poma, el de gerente de Mantenimiento.',
      ],
    },
    // ------------------------------------------------------------------ 2
    {
      title: 'Una decisión con la planta detenida', tint: ['#FF453A', '#FF9F0A', '#5E5CE6'],
      html: `${hd('Storytelling', 'Una decisión con la planta detenida')}
      <div class="hook">
        <ol class="story">
          <li data-step="1">${tile('planta', 'indigo')}<p>La planta está en una <b>parada programada de 72 horas</b> para mantenimiento.</p></li>
          <li data-step="2">${tile('lupa', 'teal')}<p>La inspección detecta que un componente de la <b>chancadora</b> supera el <b>límite de desgaste del fabricante</b>.</p></li>
          <li data-step="3">${tile('alerta', 'red')}<p>Si sigue operando, puede fallar. Mantenimiento pide <b>48 horas más</b>, pero la producción del mes va <b>por debajo de la meta</b>.</p></li>
        </ol>
        <div class="glass question" data-step="4">
          <span class="q-ico">${I('pregunta')}</span>
          <h3>¿Arrancamos a tiempo o paramos 48 horas más?</h3>
          <p class="stakes-label">En juego</p>
          <div class="stakes">
            <div class="stake" data-step="4" style="--d:280ms">${tile('grafico', 'a')}<p>La meta de producción</p></div>
            <div class="stake" data-step="4" style="--d:400ms">${tile('escudo', 'green')}<p>La seguridad de los trabajadores</p></div>
          </div>
        </div>
      </div>`,
      notes: [
        'R: Imaginen esto.',
        'R: La planta está en una parada programada de 72 horas.',
        'R: En la inspección, Mantenimiento encuentra que un componente de la chancadora supera el límite de desgaste que fija el fabricante.',
        'R: Si sigue operando, puede fallar. Mantenimiento pide 48 horas más, pero Operaciones va por debajo de su meta del mes.',
        'R: La pregunta que tuvimos que resolver fue: ¿arrancamos a tiempo o paramos 48 horas más?',
      ],
    },
    // ------------------------------------------------------------------ 3
    {
      title: 'Dos gerentes, una misma empresa', tint: ['#FF9F0A', '#0A84FF', '#FF453A'],
      html: `${hd('Diagnóstico del conflicto', 'Dos gerentes, una misma empresa')}
      <div class="duel">
        <article class="glass tinted side" style="--tint:var(--a)" data-step="1">
          <div class="who">${tile('produccion', 'a')}<div><h3>Gerente de Operaciones</h3><span>Rol A · metas de producción</span></div></div>
          <dl><dt>Posición inicial</dt><dd class="quote">«Arrancamos al cumplir las 72 horas y cambiamos la pieza en la próxima parada».</dd>
          <dt>Lo que lo presiona</dt><dd>Déficit de producción acumulado y posibles penalidades comerciales.</dd></dl>
        </article>
        <div class="vs glass" data-step="2">vs</div>
        <article class="glass tinted side" style="--tint:var(--b)" data-step="2">
          <div class="who">${tile('llave', 'b')}<div><h3>Gerente de Mantenimiento</h3><span>Rol B · confiabilidad de los equipos</span></div></div>
          <dl><dt>Posición inicial</dt><dd class="quote">«Necesito 48 horas más para cambiar y probar el componente».</dd>
          <dt>Lo que lo presiona</dt><dd>Desgaste sobre el límite del fabricante; repuestos y personal disponibles solo ahora.</dd></dl>
        </article>
      </div>
      <div class="glass banner" data-step="3">${tile('escudo', 'red')}<p><b>Condición no negociable:</b> nadie arriesga a los trabajadores y ningún equipo opera sin cumplir las condiciones técnicas. Ambos gerentes responden ante la gerencia general.</p></div>`,
      notes: [
        'J: Este es el conflicto entre las dos áreas.',
        'J: Yo represento a Operaciones. Respondo por la meta de producción y venimos con déficit, así que mi posición inicial fue no ampliar: arrancar a las 72 horas y cambiar la pieza en la próxima parada.',
        'R: Yo represento a Mantenimiento. El desgaste supera el límite del fabricante y los repuestos y el personal especializado solo están disponibles ahora; por eso pedí 48 horas más.',
        'A: Lo importante: somos de la misma empresa, respondemos ante la misma gerencia general y hay una condición que no se negocia: la seguridad y no operar un equipo fuera de condiciones técnicas.',
      ],
    },
    // ------------------------------------------------------------------ 4
    {
      title: 'Los números del caso', tint: ['#FFD60A', '#FF453A', '#0A84FF'],
      html: `${hd('Criterios objetivos', 'Los números del caso')}
      <div class="stats">
        <div class="glass stat" data-step="1"><b>72 h</b><span>Parada programada de mantenimiento</span></div>
        <div class="glass stat" data-step="1" style="--d:110ms"><b>+48 h</b><span>Tiempo adicional que pide Mantenimiento</span></div>
        <div class="glass stat" data-step="1" style="--d:220ms"><b>40 %</b><span>de la capacidad de procesamiento depende de este equipo</span></div>
        <div class="glass stat" data-step="2"><b>S/ 250 000</b><span>Pérdida por cada día de planta detenida (≈ S/ 10 417 por hora)</span></div>
        <div class="glass stat" data-step="2" style="--d:110ms"><b>S/ 500 000</b><span>Costo de ampliar la parada 48 horas</span></div>
        <div class="glass tinted stat danger" style="--tint:var(--red)" data-step="3"><b>S/ 1 200 000</b><span>Costo de una falla mayor no programada, más una parada más larga</span></div>
      </div>`,
      notes: [
        'J: Estos son los datos del caso; fueron nuestros criterios objetivos.',
        'J: La parada programada es de 72 horas, Mantenimiento pide 48 más y de este equipo depende el 40 % de la capacidad de la planta.',
        'J: Cada día con la planta detenida cuesta 250 000 soles, unos 10 417 por hora. Ampliar 48 horas cuesta 500 000.',
        'J: Pero una falla mayor costaría 1 200 000 soles, más del doble que ampliar, además de una parada más larga.',
      ],
    },
    // ------------------------------------------------------------------ 5
    {
      title: 'Lo que piden y lo que necesitan', tint: ['#64D2FF', '#0A84FF', '#FF9F0A'],
      html: `${hd('S11 · Negociación integrativa', 'Lo que piden y lo que necesitan')}
      <div class="iceberg">
        <div class="water" data-step="2"></div>
        <div class="row-label"><b>Posición</b><span>lo que dice</span></div>
        <div class="glass tinted pos" style="--tint:var(--a)" data-step="1"><span class="capsule chip a">Operaciones (A)</span><p class="quote">«No amplío: arrancamos a las 72 horas»</p></div>
        <div class="glass tinted pos" style="--tint:var(--b);--d:120ms" data-step="1"><span class="capsule chip b">Mantenimiento (B)</span><p class="quote">«Necesito 48 horas adicionales»</p></div>
        <div class="row-label under" data-step="2"><b>Intereses</b><span>lo que realmente necesita</span></div>
        <div class="glass ints" style="--tint:var(--a)" data-step="2"><ul><li>Cumplir la meta del mes y reducir el déficit</li><li>Evitar penalidades comerciales</li><li>Tener sustento ante la gerencia general</li></ul></div>
        <div class="glass ints" style="--tint:var(--b)" data-step="3"><ul><li>Evitar una falla mayor y riesgos para los trabajadores</li><li>Aprovechar repuestos y personal disponibles ahora</li><li>No ser responsable de una parada no programada</li></ul></div>
      </div>`,
      notes: [
        'J: Pasar de las posiciones a los intereses es lo que permite una negociación integrativa, como vimos en la semana 11.',
        'J: Arriba está lo que cada uno decía: yo, que no ampliaba; Roy, que necesitaba 48 horas.',
        'J: Pero lo que yo de verdad necesitaba era cumplir la meta, evitar penalidades y tener un sustento para la gerencia general.',
        'R: Y mi interés real era evitar una falla y riesgos para los trabajadores, aprovechar los repuestos de esta parada y no cargar con una parada no programada.',
      ],
    },
    // ------------------------------------------------------------------ 6
    {
      title: 'Si no hay acuerdo, ¿qué pasa?', tint: ['#FF9F0A', '#0A84FF', '#5E5CE6'],
      html: `${hd('S12 · BATNA', 'Si no hay acuerdo, ¿qué pasa?')}
      <div class="batna">
        <article class="glass" data-step="1">
          <span class="capsule chip a">Operaciones (A)</span>
          <small>Plan B</small><h3>Llevar el problema a la gerencia general</h3>
          <div class="meter" style="--c:var(--a)"><i class="on"></i><i class="on"></i><i></i><i></i><i></i><b>Débil</b></div>
          <p>Por seguridad, la gerencia igual pararía la planta, y quizá por las 48 horas completas.</p>
          <small>Su límite</small><p class="strong">Hasta 48 horas, si recibe un sustento por escrito y un plan para recuperar la producción.</p>
        </article>
        <article class="glass" data-step="2">
          <span class="capsule chip b">Mantenimiento (B)</span>
          <small>Plan B</small><h3>Hacer un informe técnico y no entregar el equipo</h3>
          <div class="meter" style="--c:var(--b)"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><b>Fuerte</b></div>
          <p>La seguridad le da la razón, pero afecta la relación con Operaciones.</p>
          <small>Su límite</small><p class="strong">No arrancar sin cambiar y probar la pieza. Mínimo 36 horas.</p>
        </article>
      </div>`,
      notes: [
        'J: Antes de negociar, cada uno pensó en su plan B: qué haría si no llegábamos a un acuerdo. En el curso se llama BATNA.',
        'J: Mi plan B era llevar el problema a la gerencia general. Era débil: por seguridad, la gerencia igual pararía la planta, y quizá por las 48 horas completas. Por eso no lo revelé. Mi límite: hasta 48 horas, si recibía un sustento por escrito y un plan para recuperar la producción.',
        'R: Mi plan B era más fuerte: hacer un informe técnico y no entregar el equipo. Pero afectaba la relación con Operaciones, y yo también respondo por los resultados. Mi límite: no arrancar sin cambiar y probar la pieza; como mínimo 36 horas. Por eso pude ceder menos.',
      ],
    },
    // ------------------------------------------------------------------ 7
    {
      title: 'La zona de posible acuerdo', tint: ['#30D158', '#0A84FF', '#FF9F0A'],
      html: `${hd('S13 · ZOPA', 'La zona de posible acuerdo')}
      <p class="lead">Es el rango de horas en el que los dos pueden decir que sí.</p>
      <div class="glass zopa">
        <div class="z-labels"><b class="ta">Operaciones (A)</b><b class="tb">Mantenimiento (B)</b></div>
        <div class="z-track">
          <div class="z-band" data-step="3"><span>Zona de acuerdo</span></div>
          <div class="z-bar a" data-step="1"><span>Acepta hasta 48 h, con sustento y un plan</span></div>
          <div class="z-bar b" data-step="2"><span>Necesita al menos 36 h</span></div>
          <div class="z-axis"><i style="--x:0">0 h</i><i style="--x:20">12 h</i><i style="--x:40">24 h</i><i class="k" style="--x:60">36 h</i><i class="k" style="--x:80">48 h</i><i style="--x:100">60 h</i></div>
        </div>
      </div>
      <div class="z-costs">
        <div class="glass mini" data-step="4"><span>Parar 36 horas cuesta</span><b>S/ 375 000</b></div>
        <div class="glass mini" data-step="4" style="--d:110ms"><span>Parar 48 horas cuesta</span><b>S/ 500 000</b></div>
        <div class="glass mini" data-step="4" style="--d:220ms"><span>Una falla costaría</span><b class="red">S/ 1 200 000</b></div>
        <div class="glass tinted mini ok" style="--tint:var(--green);--d:330ms" data-step="4"><b>Acuerdo: de 36 a 48 h</b><span>Cualquier opción sale más barata que una falla.</span></div>
      </div>`,
      notes: [
        'R: Ahora veamos dónde podíamos ponernos de acuerdo. En el curso, semana 13, se llama ZOPA: zona de posible acuerdo.',
        'R: Operaciones podía aceptar hasta 48 horas, si tenía un sustento por escrito y un plan para recuperar la producción.',
        'R: Mantenimiento necesitaba al menos 36 horas para cambiar la pieza sin recortar las pruebas.',
        'R: Donde las dos barras se cruzan, de 36 a 48 horas, los dos podemos decir que sí. Esa es la ZOPA.',
        'R: En soles: parar 36 horas cuesta 375 000 y parar 48, 500 000. Cualquier opción sale más barata que una falla de 1 200 000. Por eso negociamos dentro de esa zona, y no solo con horas, sino con un paquete de condiciones.',
      ],
    },
    // ------------------------------------------------------------------ 8
    {
      title: 'Primero ampliamos la torta', tint: ['#5E5CE6', '#30D158', '#FF9F0A'],
      html: `${hd('S11 · La torta', 'Primero ampliamos la torta')}
      <p class="lead">Sumamos variables para que los dos ganen más que solo repartiéndose horas.</p>
      <div class="mechs">
        <article class="glass mech" data-step="1">${tile('adelantar', 'indigo')}<em>1</em><h4>Adelantar el desmontaje dentro de las 72 h</h4><p><b class="ta">A gana</b>Menos horas extra y menor costo</p><p><b class="tb">B gana</b>Más tiempo efectivo para el cambio</p></article>
        <article class="glass mech" data-step="2">${tile('personas', 'teal')}<em>2</em><h4>Turnos continuos con apoyo de Operaciones</h4><p><b class="ta">A gana</b>Una parada más corta</p><p><b class="tb">B gana</b>Más manos para el trabajo técnico</p></article>
        <article class="glass mech" data-step="3">${tile('produccion', 'green')}<em>3</em><h4>Plan de recuperación de producción</h4><p><b class="ta">A gana</b>Reduce el déficit del mes</p><p><b class="tb">B gana</b>Elimina la objeción principal</p></article>
        <article class="glass mech" data-step="4">${tile('documento', 'blue')}<em>4</em><h4>Informe conjunto a la gerencia general</h4><p><b class="ta">A gana</b>Sustento ante la gerencia</p><p><b class="tb">B gana</b>Reconocen su criterio técnico</p></article>
        <article class="glass mech" data-step="5">${tile('escudo', 'orange')}<em>5</em><h4>Garantía de confiabilidad</h4><p><b class="ta">A gana</b>Certeza de no volver a parar</p><p><b class="tb">B gana</b>Demuestra el valor del mantenimiento</p></article>
      </div>
      <p class="foot">A = Operaciones · B = Mantenimiento ·</p>`,
      notes: [
        'J: Antes de repartir las horas, buscamos ampliar la torta, como vimos en la semana 11. Encontramos cinco mecanismos.',
        'J: Primero, adelantar el desmontaje dentro de las 72 horas: menos horas extra para mí y más tiempo efectivo para Mantenimiento.',
        'J: Segundo, turnos continuos con mi personal de apoyo: la parada es más corta y Mantenimiento tiene más manos.',
        'J: Tercero, un plan para recuperar la producción: reduce mi déficit y elimina mi principal objeción.',
        'J: Cuarto, un informe conjunto a la gerencia general: a mí me da sustento y a Mantenimiento le reconocen su criterio técnico.',
        'J: Y quinto, una garantía de confiabilidad: yo tengo certeza de no volver a parar y Mantenimiento demuestra su valor.',
      ],
    },
    // ------------------------------------------------------------------ 9
    {
      title: 'Cómo llegamos a 36 horas', tint: ['#FF9F0A', '#0A84FF', '#30D158'],
      html: `${hd('S13 · Concesiones condicionadas', 'Cómo llegamos a 36 horas')}
      <div class="rounds-wrap">
        <div class="glass rounds">
          <h4>Horas adicionales propuestas en cada ronda</h4>
          <div class="bars">
            <div class="grp" data-step="1"><div class="pair"><div class="bar a" style="--v:0"><b>0 h</b></div><div class="bar b" style="--v:48"><b>48 h</b></div></div><span>Apertura</span></div>
            <div class="grp" data-step="2"><div class="pair"><div class="bar a" style="--v:24"><b>24 h</b></div><div class="bar b" style="--v:40"><b>40 h</b></div></div><span>2.ª ronda</span></div>
            <div class="grp" data-step="3"><div class="pair"><div class="bar a" style="--v:30"><b>30 h</b></div><div class="bar b" style="--v:36"><b>36 h</b></div></div><span>3.ª ronda</span></div>
            <div class="grp" data-step="4"><div class="pair"><div class="bar a" style="--v:36"><b>36 h</b></div><div class="bar b" style="--v:36"><b>36 h</b></div></div><span>Acuerdo</span></div>
          </div>
          <div class="legend"><span><i class="a"></i>Operaciones (A)</span><span><i class="b"></i>Mantenimiento (B)</span></div>
        </div>
        <div class="moves">
          <h4>Cada concesión tuvo un precio</h4>
          <div class="glass move" data-step="5">${tile('intercambio', 'a')}<div><b>Operaciones: 0 → 24 → 30 h</b><span>tras conocer la evidencia del desgaste y el costo de una falla.</span></div></div>
          <div class="glass move" data-step="5" style="--d:130ms">${tile('intercambio', 'b')}<div><b>Mantenimiento: 48 → 40 → 36 h</b><span>a cambio de adelantar el desmontaje, turnos continuos y cuatro operadores de apoyo.</span></div></div>
          <div class="glass move" data-step="5" style="--d:260ms">${tile('mano', 'green')}<div><b>Acuerdo en 36 h</b><span>Operaciones acepta si recibe garantía, informe conjunto y apoyo para recuperar producción.</span></div></div>
        </div>
      </div>
      <p class="foot">Propuestas intermedias registradas durante la simulación de la negociación.</p>`,
      notes: [
        'J: Así nos movimos, ronda por ronda.',
        'J: Yo abrí en cero horas: arrancar a tiempo. Roy abrió en 48.',
        'J: Cuando vi la evidencia y el costo de una falla, subí a 24. Roy bajó a 40 si adelantábamos el desmontaje y trabajábamos en turnos continuos.',
        'J: Yo subí a 30 con mi personal de apoyo; Roy bajó a 36 con cuatro operadores de mi área, porque menos que eso recortaba las pruebas.',
        'J: Acepté 36 horas, pero a cambio de una garantía, un informe conjunto y apoyo para recuperar la producción.',
        'J: Ninguna concesión fue gratis: cada una se cambió por algo de valor.',
      ],
    },
    // ------------------------------------------------------------------ 10
    {
      title: 'El acuerdo final', tint: ['#0A84FF', '#30D158', '#FFD60A'],
      html: `${hd('Acta de acuerdo', 'El acuerdo final')}
      <div class="deal">
        <div class="glass tinted big" style="--tint:var(--blue)" data-step="1">
          <b class="count" data-from="48" data-to="36" data-suffix=" h">36 h</b>
          <span>adicionales, en lugar de 48</span>
          <b class="money">S/ 375 000</b>
          <span>Costo de la ampliación: S/ 125 000 menos que lo pedido.</span>
          <p class="sig">${I('firma')} Firmado en un acta por ambos gerentes</p>
        </div>
        <ul class="terms">
          <li class="glass" data-step="2">${tile('adelantar', 'indigo')}<p>Desmontaje y repuestos adelantados dentro de las 72 h</p><span class="capsule chip b">Mantenimiento</span></li>
          <li class="glass" data-step="2" style="--d:120ms">${tile('personas', 'teal')}<p>Turnos continuos con cuatro operadores de apoyo</p><span class="capsule chip n">Ambos</span></li>
          <li class="glass" data-step="3">${tile('check', 'green')}<p>Arranque solo con pruebas aprobadas por ambos</p><span class="capsule chip n">Ambos</span></li>
          <li class="glass" data-step="3" style="--d:120ms">${tile('produccion', 'orange')}<p>Plan de recuperación: 50 % de lo perdido en 4 semanas</p><span class="capsule chip a">Operaciones</span></li>
          <li class="glass" data-step="4">${tile('escudo', 'blue')}<p>Disponibilidad de la chancadora de 95 % por 6 meses</p><span class="capsule chip b">Mantenimiento</span></li>
          <li class="glass" data-step="4" style="--d:120ms">${tile('documento', 'indigo')}<p>Informe técnico y económico conjunto en 24 horas</p><span class="capsule chip n">Ambos</span></li>
        </ul>
      </div>
      <p class="foot">Desacuerdos futuros: reunión de ambos gerentes en 24 h → revisión con datos objetivos → gerencia general.</p>`,
      notes: [
        'J: Este fue el acuerdo.',
        'J: Ampliamos la parada 36 horas en lugar de 48, con un costo de 375 000 soles: 125 000 menos que lo pedido.',
        'J: No es solo una cifra, es un paquete. Mantenimiento adelanta el desmontaje dentro de las 72 horas y trabajamos en turnos continuos con cuatro operadores de mi área.',
        'J: El equipo solo arranca con pruebas aprobadas por ambos, y yo ejecuto un plan para recuperar la mitad de lo perdido en cuatro semanas.',
        'J: Mantenimiento garantiza 95 % de disponibilidad por seis meses y presentamos juntos el informe a la gerencia general en 24 horas. Si surge otro desacuerdo, nos reunimos en 24 horas, revisamos datos y, si sigue, lo elevamos juntos.',
      ],
    },
    // ------------------------------------------------------------------ 11
    {
      title: 'Ganar-ganar, aunque no simétrico', tint: ['#30D158', '#FF453A', '#0A84FF'],
      html: `${hd('S12 · Acuerdo frente al BATNA', 'Ganar-ganar, aunque no simétrico')}
      <div class="results">
        <div class="glass costs" data-step="1">
          <h4>Costo de cada escenario</h4>
          <div class="hbar"><span>Falla mayor no programada</span><div class="track"><i style="--v:1200;--c:var(--red)"></i></div><b>S/ 1 200 000</b></div>
          <div class="hbar"><span>Ampliar 48 h (pedido inicial)</span><div class="track"><i style="--v:500;--c:var(--gray)"></i></div><b>S/ 500 000</b></div>
          <div class="hbar"><span>Acuerdo: 36 h</span><div class="track"><i style="--v:375;--c:var(--green)"></i></div><b>S/ 375 000</b></div>
        </div>
        <div class="gains">
          <div class="glass gain" data-step="2"><span class="capsule chip a">Operaciones (A)</span><p><b>Ganó:</b> 12 horas y S/ 125 000 menos que lo pedido, más garantía, informe conjunto y apoyo para recuperar producción.</p><p><b>Mejor que su BATNA:</b> la gerencia podía ordenar 48 horas sin condiciones.</p></div>
          <div class="glass gain" data-step="3"><span class="capsule chip b">Mantenimiento (B)</span><p><b>Ganó:</b> el cambio del componente con pruebas completas y cuatro operadores de apoyo.</p><p><b>Mejor que su BATNA:</b> logra lo mismo sin romper la relación con Operaciones.</p></div>
        </div>
        <div class="glass tinted verdict" style="--tint:var(--yellow)" data-step="4">${I('trofeo')}<p><b>Mantenimiento obtuvo más:</b> logró el cambio con pruebas completas y solo cedió 12 horas, gracias a su BATNA más fuerte.</p></div>
      </div>`,
      notes: [
        'R: ¿Quién ganó? Los dos, aunque no por igual.',
        'R: Primero, el costo: el acuerdo de 375 000 soles es mucho menor que el riesgo de una falla de 1 200 000.',
        'R: Operaciones ganó 12 horas y 125 000 soles menos que lo pedido, más una garantía, un informe conjunto y apoyo para recuperar la producción. Si elevaba el caso, la gerencia podía ordenar las 48 horas sin condiciones.',
        'R: Mantenimiento logró el cambio con pruebas completas y cuatro operadores de apoyo, sin romper la relación con Operaciones.',
        'R: Mantenimiento obtuvo más porque tenía un BATNA más fuerte. La consigna acepta resultados asimétricos si los dos satisfacen sus intereses fundamentales.',
      ],
    },
    // ------------------------------------------------------------------ 12
    {
      title: 'Viable, relevante y sostenible', tint: ['#FFD60A', '#0A84FF', '#30D158'],
      html: `${hd('', 'Viable, relevante y sostenible')}
      <div class="pillars">
        <article class="glass pillar" data-step="1">${tile('check', 'green')}<h3>Viable</h3><p>Está dentro de la ZOPA y respeta la condición no negociable: el equipo arranca solo con pruebas aprobadas.</p></article>
        <article class="glass pillar" data-step="2">${tile('objetivo', 'blue')}<h3>Relevante</h3><p>Responde a lo que cada área necesitaba: producción y sustento para Operaciones; seguridad y confiabilidad para Mantenimiento.</p></article>
        <article class="glass pillar" data-step="3">${tile('hoja', 'teal')}<h3>Sostenible</h3><p>Cada compromiso tiene responsable, plazo e indicador, y hay un procedimiento para futuros desacuerdos.</p></article>
      </div>
      <p class="closing" data-step="4">Cambiamos 36 horas de parada por <span class="grad">seis meses de confiabilidad</span>.</p>
      <p class="thanks" data-step="5">Gracias. ¿Preguntas?</p>`,
      notes: [
        'J: Para cerrar, tres razones de por qué esta solución funciona.',
        'J: Es viable: está dentro de la ZOPA y respeta la condición no negociable.',
        'J: Es relevante: responde a lo que cada área necesitaba.',
        'R: Y es sostenible: cada compromiso tiene responsable, plazo e indicador, y acordamos cómo resolver futuros desacuerdos.',
        'R: Volviendo a la pregunta del inicio: no arrancamos a tiempo ni paramos 48 horas; cambiamos 36 horas de parada por seis meses de confiabilidad.',
        'A: Muchas gracias. ¿Preguntas?',
      ],
    },
  ];

  const qa = [
    ['¿Por qué 36 horas y no 30?', 'Porque 36 es el mínimo técnico que definimos: con turnos continuos y cuatro operadores, menos horas recortarían las pruebas, y la condición no negociable impide arrancar sin pruebas aprobadas.'],
    ['¿De dónde salen el 50 % y el 95 %?', 'Son metas que acordamos en la negociación. El caso no las fija; las pusimos para que cada compromiso tenga un indicador medible y un mecanismo de verificación.'],
    ['¿Y si la probabilidad de falla fuera baja?', 'Igual convenía ampliar: una falla costaría S/ 1 200 000, más del doble que ampliar (S/ 500 000). Además, el desgaste ya supera el límite del fabricante y no se puede operar un equipo fuera de condiciones técnicas.'],
    ['¿Por qué es ganar-ganar si Mantenimiento ganó más?', 'Porque los dos quedaron mejor que con su BATNA y satisficieron sus intereses fundamentales. La consigna acepta resultados asimétricos.'],
    ['¿Cuál era el BATNA de cada uno?', 'Operaciones: elevar la decisión a la gerencia general (débil). Mantenimiento: informe técnico y no liberar el equipo (más fuerte, pero rompía la relación).'],
    ['¿Qué técnica fue la más importante?', 'Comenzar preguntando: así Operaciones reveló su interés real, un sustento por escrito y un plan de recuperación, y con eso armamos el paquete.'],
    ['¿Cómo ampliaron la torta?', 'Con cinco mecanismos: tareas adelantadas, turnos continuos con apoyo, plan de recuperación, informe conjunto y garantía de confiabilidad.'],
    ['¿Qué pasa si surge otro desacuerdo?', 'Reunión de ambos gerentes en 24 horas, revisión con datos objetivos (pruebas, producción, fabricante) y, si sigue, elevar el caso juntos a la gerencia general.'],
  ];

  // Número de pasos de cada lámina (el mayor data-step)
  for (const s of slides) {
    const pasos = [...s.html.matchAll(/data-step="(\d+)"/g)].map((m) => +m[1]);
    s.steps = pasos.length ? Math.max(...pasos) : 0;
    if (s.notes.length !== s.steps + 1) console.warn(`Lámina «${s.title}»: ${s.steps + 1} pasos y ${s.notes.length} notas`);
  }

  window.DECK = { id: 'ta2-caso4', title: 'TA2 · Caso 4 · Grupo 13', slides, qa };
})();
