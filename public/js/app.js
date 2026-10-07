/* ═══════════════════════════════════════════════════════════════════
   PLACETA JUNIOR — Web pública (junior.laplaceta.org)
   Consume la API oficial de admin-placeta (RSP) /api/junior/...
   ═══════════════════════════════════════════════════════════════════ */

// BFF del mismo dominio por defecto; permite apuntar a otro entorno desde
// window.PJ_API_BASE sin recompilar la web.
const API_BASE = (window.PJ_API_BASE || (location.hostname === 'junior.laplaceta.org' ? '/api/junior' : 'https://rsp.laplaceta.org/api/junior')).replace(/\/$/, '');

// ── Helpers ──────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── Reparación de URLs de imagen ─────────────────────────────────────
// Algunas actividades (generadas con IA) guardan la URL de la imagen como
// un enlace Markdown partido por el ':' de la propia URL (p. ej. el ':' de
// "…/wiki/Special:Redirect/file/X.svg"). Ejemplo real guardado:
//   "imagen_url": "[https://…/wiki/Special](https://…/wiki/Special):Redirect/file/X.svg"
// Aquí se reconstruye la URL real para que la imagen pueda mostrarse.
function pjUrlImg(u) {
  u = String(u ?? '').trim();
  if (!u) return u;
  const ini = u.indexOf('](');
  if (ini > -1) {
    const fin = u.indexOf(')', ini + 2);
    if (fin > -1) {
      const etiqueta = u.slice(0, ini).replace(/^\[\s*/, '').trim();
      const href = u.slice(ini + 2, fin).trim();
      const resto = u.slice(fin + 1).trim();
      for (const c of [href + resto, href, etiqueta]) {
        const limpia = pjUrlEsquema(c);
        if (/^https?:\/\//i.test(limpia)) return limpia;
      }
    }
  }
  return pjUrlEsquema(u);
}
function pjUrlEsquema(u) {
  return String(u ?? '').trim().replace(/^([a-z][a-z0-9+.\-]*):\/([^/])/i, '$1://$2');
}
function pjEsCampoImagen(k) {
  return k === 'imagen_url' || k === 'imagenUrl' || k === 'image_url' || k === 'imageUrl' || k === 'imagen' || k === 'izq_img' || k === 'izq_imagen_url' || k === 'izqImg' || k === 'portada_url' || k === 'portadaUrl';
}
function pjSaneaImagenes(raiz) {
  if (!raiz) return 0;
  let cambios = 0;
  if (Array.isArray(raiz)) { for (const x of raiz) cambios += pjSaneaImagenes(x); return cambios; }
  if (raiz && typeof raiz === 'object') {
    for (const k of Object.keys(raiz)) {
      const v = raiz[k];
      if (typeof v === 'string') {
        if (pjEsCampoImagen(k)) { const c = pjUrlImg(v); if (c !== v) { raiz[k] = c; cambios++; } }
      } else if (v && typeof v === 'object') { cambios += pjSaneaImagenes(v); }
    }
  }
  return cambios;
}

// Colores por categoría (identidad PJ)
const categoriaColor = (cat = '') => {
  const c = cat.toLowerCase();
  if (c.includes('mate')) return 'blue';
  if (c.includes('leng') || c.includes('lect')) return 'red';
  if (c.includes('natur') || c.includes('cien') || c.includes('bio')) return 'green';
  if (c.includes('geo') || c.includes('hist') || c.includes('social')) return 'orange';
  if (c.includes('arte') || c.includes('mús') || c.includes('mus')) return 'purple';
  if (c.includes('code') || c.includes('program') || c.includes('inform')) return 'purple';
  return 'purple';
};

// Iconos Material Symbols por categoría (identidad PJ)
const categoriaIcono = (cat = '') => {
  const c = cat.toLowerCase();
  if (c.includes('mate')) return 'calculate';
  if (c.includes('leng') || c.includes('lect')) return 'menu_book';
  if (c.includes('cien') || c.includes('medio')) return 'science';
  if (c.includes('geo')) return 'public';
  if (c.includes('tecn') || c.includes('inform')) return 'computer';
  if (c.includes('logic')) return 'psychology';
  if (c.includes('code') || c.includes('program') || c.includes('inform')) return 'code';
  return 'extension';
};

// Color sólido de marca para el icono (según la categoría)
const colorMaterial = (cat = '') => {
  const map = {
    blue: '#3A00E1', green: '#336E45', orange: '#FF6600',
    red: '#FF3333', purple: '#4E3B70', yellow: '#D6CE52'
  };
  return map[categoriaColor(cat)] || map.purple;
};

// ── Portada de la actividad (carátula generada automáticamente) ────
function coverHTML(a, badgeProg = '') {
  const bloqueada = esBloqueada(a);
  const portada = a.portada_url || a.portadaUrl || a.contenido?.__rspPortadaUrl || a.contenido?.__rsp_portada_url || '';
  const badge = a.es_examen
    ? '<span class="badge-tag badge-examen"><span class="material-symbols-rounded b-ico">school</span>Examen</span>'
    : (bloqueada
        ? '<span class="badge-tag badge-premium"><span class="material-symbols-rounded b-ico">credit_card</span>De pago</span>'
        : (esPago(a)
            ? '<span class="badge-tag badge-premium"><span class="material-symbols-rounded b-ico">redeem</span>Subvencionada</span>'
            : '<span class="badge-tag badge-free"><span class="material-symbols-rounded b-ico">check_circle</span>Gratis</span>'));
  const lock = bloqueada
    ? '<div class="cover-lock"><span class="material-symbols-rounded lock-ico">lock</span><span class="lock-txt">De pago</span></div>'
    : '';
  // Si hay portada real la usamos; si no, se genera una imagen (miniaturas reales con canvas)
  const estilo = portada
    ? `style="background-image:url('${String(portada).replace(/'/g, '%27')}');background-size:contain;background-repeat:no-repeat;background-position:center;"`
    : `data-gen="1" data-cat="${escapeHtml(a.categoria || '')}" data-tipo="${escapeHtml(a.tipo || '')}"`;
  const icono = iconoMaterial(a);
  return `
    <div class="card-cover" ${estilo}>
      ${!portada && icono ? `<span class="cover-emoji material-symbols-rounded" style="color:${colorMaterial(a.categoria)}">${icono}</span>` : ''}
      ${badge}
      ${badgeProg}
      ${lock}
      <button class="info-btn" onclick="event.stopPropagation();verInfo('${a.id}')" title="Ver información"><span class="material-symbols-rounded">info</span></button>
    </div>`;
}

// ── Miniaturas reales: genera una imagen PNG con canvas ─────────────
function coloresCaratula(color) {
  const map = {
    blue: ['#3A00E1', '#6a4bff'], green: ['#336E45', '#5aa06f'],
    orange: ['#FF6600', '#ff9a3d'], red: ['#FF3333', '#ff7a5c'],
    purple: ['#4E3B70', '#7a63a8'], yellow: ['#D6CE52', '#efe78a'],
    pink: ['#E6007E', '#ff66b3']
  };
  return map[color] || map.purple;
}
function dibujarForma(ctx, x, y, s) {
  ctx.save(); ctx.globalAlpha = 0.18; ctx.translate(x, y); ctx.rotate(-0.22);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0.5 * s, 0); ctx.lineTo(0.96 * s, 0.28 * s); ctx.lineTo(0.92 * s, 0.78 * s);
  ctx.lineTo(0.4 * s, s); ctx.lineTo(0.04 * s, 0.72 * s); ctx.lineTo(0.08 * s, 0.22 * s);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function tipoIcono(tipo = '') {
  if (tipo === 'sopa_letras') return 'text_fields';
  if (tipo === 'relacionar_conceptos' || tipo === 'relacionar_imagenes') return 'link';
  if (tipo === 'ordenar_elementos') return 'format_list_numbered';
  if (tipo === 'completar_frases') return 'edit_note';
  if (tipo === 'verdadero_falso') return 'balance';
  if (tipo === 'logica' || tipo === 'retos_interactivos') return 'psychology';
  return '';
}
function iconoMaterial(a) {
  return tipoIcono(a.tipo || '') || categoriaIcono(a.categoria || a.cat || '');
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function generarCaratula(a) {
  return new Promise((resolve) => {
    try {
      const W = 640, H = 360; // 16:9
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const [c1, c2] = coloresCaratula(categoriaColor(a.cat));

      // Fondo: degradado diagonal
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // Patrón de formas oficiales dispersas
      ctx.globalAlpha = 0.13;
      for (let i = 0; i < 9; i++) {
        const x = 24 + ((i * 73) % (W - 70));
        const y = 18 + ((i * 97) % (H - 40));
        dibujarForma(ctx, x, y, 24 + (i % 4) * 12);
      }
      ctx.globalAlpha = 0.10;
      dibujarForma(ctx, W - 130, H - 130, 210);
      ctx.globalAlpha = 1;

      // Puntos decorativos
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.arc(14 + ((i * 53) % (W - 28)), 12 + ((i * 71) % (H - 24)), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Medallón redondeado (el icono Material se superpone por HTML encima)
      const mx = W / 2, my = 128, r = 74;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRectPath(ctx, mx - r, my - r, r * 2, r * 2, 30);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
      roundRectPath(ctx, mx - r + 7, my - r + 7, r * 2 - 14, r * 2 - 14, 24);
      ctx.stroke();

      // Degradado inferior para contraste (blanco en code para leer título negro)
      const esCode = a.tipo === 'code_blocks'
        || (a.cat || '').toLowerCase().includes('code')
        || (a.cat || '').toLowerCase().includes('progra');
      const fade = ctx.createLinearGradient(0, H - 130, 0, H);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, esCode ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.38)');
      ctx.fillStyle = fade; ctx.fillRect(0, H - 130, W, 130);

      // Título compacto con sombra (negro en la categoría code)
      ctx.save();
      ctx.shadowColor = esCode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      ctx.fillStyle = esCode ? '#111111' : '#ffffff';
      ctx.font = '800 28px "Plus Jakarta Sans","Arial",sans-serif';
      const t = (a.tit || '').toUpperCase();
      ctx.fillText(t.length > 22 ? t.slice(0, 21) + '…' : t, W / 2, 244);
      ctx.restore();

      // Pill de categoría
      const catLabel = (a.cat || 'GENERAL').toUpperCase();
      ctx.font = '800 17px "Plus Jakarta Sans","Arial",sans-serif';
      const catW = ctx.measureText(catLabel).width + 34;
      ctx.fillStyle = 'rgba(20,20,40,0.6)';
      roundRectPath(ctx, (W - catW) / 2, 288, catW, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(catLabel, W / 2, 304);

      resolve(cv.toDataURL('image/png'));
    } catch (e) { resolve(''); }
  });
}
function generarCaratulasEn(cont) {
  if (!cont) return;
  cont.querySelectorAll('.card-cover[data-gen="1"]').forEach((el) => {
    const card = el.closest('.card');
    const tit = (card?.querySelector('h3')?.textContent || '').trim();
    const cat = el.dataset.cat || '';
    const tipo = el.dataset.tipo || '';
    generarCaratula({ cat, tit, tipo }).then((url) => {
      if (url) { el.style.backgroundImage = `url('${url}')`; el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center'; }
    });
  });
}

function cardActividad(a) {
  const bloqueada = esBloqueada(a);
  const tieneUnidades = obtenerUnidadesActividad(a).length > 0;
  const color = categoriaColor(a.categoria);
  const enCurso = window.PJPartidas ? PJPartidas.estaEnCurso(a.id) : false;
  const completada = window.PJPartidas ? PJPartidas.estaCompletada(a.id) : false;
  const visitas = Number(a.visitas ?? a.visitas_count ?? a.views ?? a.estadisticas?.visitas ?? a.estadisticas?.visitas_totales ?? a.estadisticas?.veces_realizada ?? 0) || 0;
  // Solo mostramos "Hecha"; el botón "Continuar" ya indica una partida en curso.
  const badgeProg = completada
    ? '<span class="badge-tag badge-free badge-prog"><span class="material-symbols-rounded b-ico">task_alt</span>Hecha</span>'
    : '';
  return `
    <div class="card" data-color="${color}" onclick="verInfo('${a.id}')" role="button" tabindex="0" aria-label="Ver detalles de ${escapeHtml(a.titulo)}">
      ${coverHTML(a, badgeProg)}
      <h3>${escapeHtml(a.titulo)}</h3>
      <div class="card-foot">
        <span class="chip" data-color="${color}">${escapeHtml(a.categoria)}</span>
        <span class="card-visits" title="Número de visitas"><span class="material-symbols-rounded" aria-hidden="true">visibility</span>${visitas.toLocaleString('es-ES')}</span>
        ${!bloqueada ? `<button type="button" class="cover-play" onclick="event.stopPropagation();abrirActividad('${a.id}', false)" title="${enCurso ? 'Continuar' : 'Jugar'}"><span class="material-symbols-rounded">play_arrow</span> ${enCurso ? 'Continuar' : 'Jugar'}</button>` : ''}
      </div>
    </div>`;
}

function cambiarPestanaDetalle(tab, nombre) {
  const root = document.getElementById('detail-page');
  if (!root) return;
  root.querySelectorAll('[data-detail-panel]').forEach(panel => {
    panel.classList.toggle('is-active', panel.dataset.detailPanel === nombre);
  });
  root.querySelectorAll('.detail-tabs [role="tab"]').forEach(item => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (window.pjSonido) pjSonido.clic();
}

// Página de DETALLE de la actividad (a pantalla completa, no popup)
function verInfo(id) {
  const a = TODAS.find(x => x.id === id);
  if (!a) return;
  if (window.pjSonido) pjSonido.abrir();
  const bloqueada = esBloqueada(a);
  const color = categoriaColor(a.categoria);
  const unidades = obtenerUnidadesActividad(a);
  const nBloques = unidades.length
    ? unidades.length
    : ((a.contenido && a.contenido.bloques) ? a.contenido.bloques.length : (a.num_fases || 0));
  const nPreg = a.num_preguntas || 0;
  const colaborador = a.colaborador_nombre || a.colaborador || a.autor_nombre || a.autor || a.creador_nombre || a.creador || a.entidad_nombre || a.entidad || 'Equipo Placeta Junior';
  const fechaRaw = a.created_at || a.createdAt || a.fecha_publicacion || a.fechaPublicacion || a.publicado_at || '';
  const fecha = fechaRaw ? new Date(fechaRaw).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Actividad publicada';
  const unidadesHtml = unidades.length ? `<div class="detail-panel detail-panel-slides" data-detail-panel="slides" id="detalle-unidades"><div class="detail-card detail-unidades"><h2>Diapositivas de la aventura</h2><p class="detail-units-lead">Avanza a tu ritmo. Cada parte desbloquea un nuevo reto.</p>${unidades.map((n, i) => {
    const recompensa = Number(n.recompensa || 0);
    const desc = typeof n.descripcion === 'string' ? n.descripcion : '';
    const disponible = i === 0 || (window.PJPartidas && window.PJPartidas.estaCompletada(`${a.id}::unidad::${i - 1}`));
    return `<button class="detail-unit${disponible ? '' : ' is-locked'}" type="button" ${disponible ? `onclick="abrirUnidad('${a.id}',${i})"` : 'disabled'}><div><strong>Unidad ${i + 1}</strong><span>${escapeHtml(n.titulo || 'Siguiente unidad')}</span>${desc ? `<small>${escapeHtml(desc)}</small>` : ''}</div><b>${disponible ? (recompensa ? `+${recompensa} Pz · Empezar` : 'Empezar') : '🔒 Completa la anterior'}</b></button>`;
  }).join('')}</div></div>` : '';
  document.getElementById('detail-page').innerHTML = `
    <a class="detail-back" href="javascript:cerrarDetalle()"><span class="material-symbols-rounded">arrow_back</span> Volver a Actividades</a>
    <div class="detail-top">
    <div class="detail-hero">
      <div class="detail-cover" id="detail-cover"></div>
    </div>
    <div class="detail-head">
      <span class="chip" data-color="${color}">${escapeHtml(a.categoria)}</span>
      <h1>${escapeHtml(a.titulo)}</h1>
      <div class="detail-byline">
        <span><span class="material-symbols-rounded">person</span><b>Creado por</b> ${escapeHtml(colaborador)}</span>
        <span><span class="material-symbols-rounded">calendar_today</span>${escapeHtml(fecha)}</span>
      </div>
      ${!bloqueada ? `<button class="detail-play" type="button" onclick="abrirActividad('${a.id}', false)"><span class="material-symbols-rounded">play_arrow</span> Jugar ahora</button>` : '<span class="chip red detail-locked"><span class="material-symbols-rounded">lock</span> Actividad premium</span>'}
    </div>
    </div>
    <div class="detail-body">
      <nav class="detail-tabs" role="tablist" aria-label="Secciones de la actividad">
        <button class="is-active" type="button" role="tab" aria-selected="true" onclick="cambiarPestanaDetalle(this, 'info')">Información</button>
        ${unidades.length ? `<button type="button" role="tab" aria-selected="false" onclick="cambiarPestanaDetalle(this, 'slides')">Diapositivas <span>${unidades.length}</span></button>` : ''}
      </nav>
      <div class="detail-panel detail-panel-info is-active" data-detail-panel="info">
      <div class="detail-stats">
        <div class="dstat"><span class="material-symbols-rounded">child_care</span><span class="dstat-lbl">Edad</span><span class="dstat-val">${escapeHtml(a.edad_recomendada || '6-12')}</span></div>
        <div class="dstat"><span class="material-symbols-rounded">trending_up</span><span class="dstat-lbl">Dificultad</span><span class="dstat-val">${escapeHtml(a.dificultad || 'media')}</span></div>
        <div class="dstat"><span class="material-symbols-rounded">quiz</span><span class="dstat-lbl">Preguntas</span><span class="dstat-val">${nPreg}</span></div>
        <div class="dstat"><span class="material-symbols-rounded">flag</span><span class="dstat-lbl">Niveles</span><span class="dstat-val">${nBloques}</span></div>
      </div>
      <div class="detail-card" id="detalle-info">
        <h2>¿De qué trata esta actividad?</h2>
        <p>${escapeHtml(a.descripcion || '')}</p>
        ${a.recompensa ? `<div class="detail-reward"><span class="material-symbols-rounded">military_tech</span><div><span class="reward-lbl">Recompensa</span><span class="reward-val">+${a.recompensa} Pz</span></div></div>` : ''}
      </div>
      </div>
      ${unidadesHtml}
      <div class="detail-actions">
        ${unidades.length ? '<span class="detail-select-hint">Puedes empezar desde una diapositiva</span>' : (bloqueada
          ? '<span class="chip red">🔒 De pago (no subvencionada)</span>'
          : '')}
        <button class="btn btn-outline btn-lg" onclick="descargarPdf('${a.id}')"><span class="material-symbols-rounded">download</span> Descargar PDF</button>
      </div>
    </div>`;
  document.body.classList.add('mostrando-detalle');
  document.title = `${a.titulo} | Placeta Junior`;
  try { if (!location.search.includes('id=')) history.pushState(null, '', '/?id=' + encodeURIComponent(a.id)); } catch (e) { /* sin historial */ }
  window.scrollTo(0, 0);
  const coverEl = document.getElementById('detail-cover');
  const portadaDetalle = a.portada_url || a.portadaUrl || a.contenido?.__rspPortadaUrl || a.contenido?.__rsp_portada_url || '';
  if (portadaDetalle) {
    coverEl.style.backgroundImage = `url('${String(portadaDetalle).replace(/'/g, '%27')}')`;
  } else {
    generarCaratula({ cat: a.categoria, tit: a.titulo, tipo: a.tipo }).then(url => {
      if (url) coverEl.style.backgroundImage = `url('${url}')`;
    });
  }
}
function cerrarDetalle() {
  document.body.classList.remove('mostrando-detalle');
  document.title = 'Actividades | Placeta Junior';
  try { if (location.search.includes('id=')) history.replaceState(null, '', '/'); } catch (e) { /* sin historial */ }
  window.scrollTo(0, 0);
}

// Genera el worksheet imprimible de una actividad code_blocks.
// Muestra cada ejercicio con su cuadrícula, una GUÍA de los bloques
// disponibles y el PROGRAMA COMPLETO (la solución), no casillas en blanco.
function generarPdfCode(a) {
  const contenido = a.contenido || {};
  const ejercicios = (window.PJCode && PJCode.obtenerEjercicios)
    ? PJCode.obtenerEjercicios(contenido)
    : [{
        titulo: contenido.titulo || 'Ejercicio 1',
        explicacion: contenido.explicacion || '',
        objetivo_texto: contenido.objetivo_texto || 'Lleva a Candela hasta la estrella.',
        escenario: contenido.escenario || { tipo: 'cuadricula', ancho: 6, alto: 6 },
        inicio: contenido.inicio || { x: 0, y: 0, direccion: 'derecha' },
        objetivo: contenido.objetivo || {},
        bloques_permitidos: contenido.bloques_permitidos || null,
        pistas: contenido.pistas || []
      }];

  // Guía de cada bloque (icono + nombre + qué hace)
  const guiaBloque = {
    avanzar:    { nombre: 'AVANZAR',    ico: '➡️', desc: 'Avanza 1 casilla' },
    retroceder: { nombre: 'RETROCEDER', ico: '⬅️', desc: 'Retrocede 1 casilla' },
    girar:      { nombre: 'GIRAR',      ico: '🔄', desc: 'Gira a la derecha o a la izquierda' },
    saltar:     { nombre: 'SALTAR',     ico: '⤴️', desc: 'Salta 2 casillas' },
    repetir:    { nombre: 'REPETIR',    ico: '🔁', desc: 'Repite los pasos N veces' },
    si:         { nombre: 'SI',         ico: '❓', desc: 'Si se cumple la condición…' }
  };

  // Dibuja la cuadrícula del ejercicio como tabla HTML para imprimir
  function cuadricula(ej) {
    const esc = ej.escenario || {};
    const ancho = esc.ancho || 6, alto = esc.alto || 6;
    const obj = ej.objetivo || {};
    const ini = ej.inicio || {};
    const obst = new Set((esc.obstaculos || []).map(o => o.x + ',' + o.y));
    const mon = new Set((esc.monedas || []).map(m => m.x + ',' + m.y));
    const cellMm = Math.max(6, Math.min(12, Math.floor(150 / ancho)));
    const fs = Math.max(8, cellMm - 3);
    let html = '<table class="ws-code-grid" style="border-collapse:collapse;margin:8px auto;">';
    for (let r = 0; r < alto; r++) {
      html += '<tr>';
      for (let c = 0; c < ancho; c++) {
        let txt = '';
        if (obst.has(c + ',' + r)) txt = '🚧';
        else if (mon.has(c + ',' + r)) txt = '🪙';
        if (obj.posicion && obj.posicion.x === c && obj.posicion.y === r) txt = '⭐';
        if (ini.x === c && ini.y === r) txt = '👧';
        html += '<td style="width:' + cellMm + 'mm;height:' + cellMm + 'mm;text-align:center;vertical-align:middle;border:1px solid #8a91a0;font-size:' + fs + 'px;">' + txt + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  }

  // Calcula el programa solución con BFS (bloques simples) y lo VERIFICA
  // con el motor real. Devuelve null si no se puede resolver (p. ej. ejercicios
  // que exigen REPETIR/SI) → entonces se muestra una zona de escritura.
  function resolverPrograma(ej, permitidos) {
    const obj = ej.objetivo || {};
    if (!obj.posicion || !window.PJCode) return null;
    if ((obj.debe_usar || []).some(op => op === 'repetir' || op === 'si')) return null;
    const ops = [];
    if (permitidos.includes('avanzar')) ops.push('avanzar');
    if (permitidos.includes('retroceder')) ops.push('retroceder');
    if (permitidos.includes('saltar')) ops.push('saltar');
    if (permitidos.includes('girar')) { ops.push('girar:der'); ops.push('girar:izq'); }
    if (!ops.length) return null;
    const esc = ej.escenario || {};
    const ancho = esc.ancho || 6, alto = esc.alto || 6;
    const obst = new Set((esc.obstaculos || []).map(o => o.x + ',' + o.y));
    const ini = ej.inicio || {};
    const sx = ini.x ?? 0, sy = ini.y ?? 0;
    const sd = ['derecha', 'abajo', 'izquierda', 'arriba'].indexOf(ini.direccion || 'derecha');
    const d0 = sd < 0 ? 0 : sd;
    const deltas = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
    const tx = Number(obj.posicion.x), ty = Number(obj.posicion.y);
    const maxDepth = Math.min(Number(obj.max_pasos) || (ancho * alto * 2), 40);
    const dentro = (xx, yy) => xx >= 0 && xx < ancho && yy >= 0 && yy < alto;
    const visitado = new Set();
    const cola = [{ x: sx, y: sy, d: d0, acc: [] }];
    visitado.add(sx + ',' + sy + ',' + d0);
    let solucion = null;
    while (cola.length) {
      const st = cola.shift();
      if (st.acc.length > maxDepth) continue;
      if (st.x === tx && st.y === ty) { solucion = st.acc; break; }
      for (const op of ops) {
        let nx = st.x, ny = st.y, nd = st.d, acc = null;
        if (op === 'avanzar') { nx = st.x + deltas[st.d].x; ny = st.y + deltas[st.d].y; if (!dentro(nx, ny) || obst.has(nx + ',' + ny)) continue; acc = { op: 'avanzar' }; }
        else if (op === 'retroceder') { nx = st.x - deltas[st.d].x; ny = st.y - deltas[st.d].y; if (!dentro(nx, ny) || obst.has(nx + ',' + ny)) continue; acc = { op: 'retroceder' }; }
        else if (op === 'saltar') { nx = st.x + deltas[st.d].x * 2; ny = st.y + deltas[st.d].y * 2; if (!dentro(nx, ny)) continue; acc = { op: 'saltar' }; }
        else if (op === 'girar:der') { nd = (st.d + 1) % 4; acc = { op: 'girar', dir: 'derecha' }; }
        else if (op === 'girar:izq') { nd = (st.d + 3) % 4; acc = { op: 'girar', dir: 'izquierda' }; }
        const key = nx + ',' + ny + ',' + nd;
        if (visitado.has(key)) continue;
        visitado.add(key);
        cola.push({ x: nx, y: ny, d: nd, acc: st.acc.concat([acc]) });
      }
    }
    if (!solucion) return null;
    // Verificación final con el motor real (incluye monedas)
    const res = PJCode.ejecutarCode(esc, ini, solucion, { maxPasos: maxDepth });
    const monedasReq = Number(obj.monedas) || 0;
    const ok = res && res.posicion_final && res.posicion_final.x === tx && res.posicion_final.y === ty
      && (res.monedas_recogidas ? res.monedas_recogidas.length : 0) >= monedasReq;
    return ok ? solucion : null;
  }

  let cuerpo = '<div class="ws-sec ws-code"><h4>💻 Placeta Junior Code — Programa</h4>';
  cuerpo += '<p class="ws-hint">Programa a Candela 👧 para llegar a la estrella ⭐. Revisa la guía de bloques y el programa completo de cada ejercicio.</p>';
  ejercicios.forEach((ej, i) => {
    const permitidos = (ej.bloques_permitidos && ej.bloques_permitidos.length) ? ej.bloques_permitidos : ['avanzar', 'girar'];
    cuerpo += '<div class="ws-code-ej">';
    cuerpo += '<h5>Ejercicio ' + (i + 1) + ' — ' + esc(ej.titulo || '') + '</h5>';
    if (ej.explicacion) cuerpo += '<p class="ws-hint">' + esc(ej.explicacion) + '</p>';
    cuerpo += '<p class="ws-hint"><b>Objetivo:</b> ' + esc(ej.objetivo_texto || '') + '</p>';
    // GUÍA DE BLOQUES del ejercicio (al inicio)
    cuerpo += '<div class="ws-guia-bloques"><b>Guía de bloques:</b>';
    permitidos.forEach(p => {
      const g = guiaBloque[p];
      if (g) cuerpo += '<span class="ws-bloque">' + g.ico + ' ' + esc(g.nombre) + ' · ' + esc(g.desc) + '</span>';
    });
    cuerpo += '</div>';
    cuerpo += cuadricula(ej);
    // PROGRAMA COMPLETO (solución del autor o calculada; si no, zona de escritura)
    const sol = (Array.isArray(ej.programa_solucion) && ej.programa_solucion.length)
      ? ej.programa_solucion
      : resolverPrograma(ej, permitidos);
    cuerpo += '<div class="ws-programa">';
    if (sol && sol.length) {
      const texto = sol.map(bl => {
        const g = guiaBloque[bl.op];
        if (bl.op === 'girar') return (String(bl.dir || 'derecha').toLowerCase().startsWith('izq') ? 'GIRAR ←' : 'GIRAR →');
        return g ? g.nombre : String(bl.op || '').toUpperCase();
      }).join('  ·  ');
      cuerpo += '<p class="ws-words"><b>Programa:</b> ' + esc(texto) + '</p>';
    } else {
      cuerpo += '<p class="ws-words"><b>Programa:</b> ______________________________</p>';
    }
    cuerpo += '</div>';
    cuerpo += '</div>';
  });
  cuerpo += '</div>';
  return cuerpo;
}

// Worksheet imprimible en PDF A4 (ventana de impresión del navegador)
async function descargarPdf(id) {
  const a = TODAS.find(x => x.id === id) || null;
  if (!a) return;
  // Reconstruye las URLs de imagen guardadas partidas como enlace Markdown.
  pjSaneaImagenes(a);
  const cargaPdf = document.createElement('div');
  cargaPdf.className = 'pj-pdf-loading';
  cargaPdf.innerHTML = '<div class="pj-pdf-loading-card"><span class="loader"></span><strong>Preparando tu ficha…</strong><small>Cargando imágenes y unidades</small></div>';
  document.body.appendChild(cargaPdf);
  if (window.pjSonido) pjSonido.clic();
  const esCode = a.tipo === 'code_blocks' || (a.contenido && a.contenido.tipo === 'code_blocks');
  const bloques = (a.contenido && a.contenido.bloques) || [];
  const unidadesPdf = obtenerUnidadesActividad(a);
  const wsImg = (url, fuente) => url
    ? `<div class="ws-img"><img src="${esc(url)}" alt=""><span class="ws-fuente">${esc(fuente || 'Imagen')}</span></div>`
    : '';
  let cuerpo = '';
  if (esCode) {
    cuerpo = generarPdfCode(a);
  }
  const imprimirBloque = (b) => {
    b = { ...b, imagen_url: b.imagen_url || b.imagenUrl || b.imagen || b.image_url || b.imageUrl || '' };
    if (b.tipo === 'test' && b.preguntas && b.preguntas.length) {
      cuerpo += '<div class="ws-sec ws-test"><h4>Preguntas</h4>';
      b.preguntas.forEach((p, k) => {
        const opts = (p.opciones || []).map((o, oi) => '<span class="ws-opt">' + ('ABCDEFGH'[oi] || '') + ') ' + esc(o) + '</span>').join(' ');
        cuerpo += '<div class="ws-q"><span class="ws-n">' + (k + 1) + '.</span> ' + esc(p.pregunta || '') + wsImg(p.imagen_url || p.pictograma, p.fuente) + '<div class="ws-opts">' + opts + '</div></div>';
      });
      cuerpo += '</div>';
    } else if (b.tipo === 'texto' && (((b.contenido || '').trim()) || b.imagen_url)) {
      cuerpo += '<div class="ws-sec"><h4>' + esc(b.titulo || 'Aprende') + '</h4>' + wsImg(b.imagen_url, b.fuente) + '<div class="ws-richtext">' + formatearTextoJugador(obtenerContenidoTextoPJ(b)) + '</div></div>';
    } else if (b.tipo === 'sopa_letras' && b.palabras && b.palabras.length) {
      let gridHtml = '';
      if (typeof generarSopa === 'function') {
        const sopa = generarSopa(b.palabras, b.tamano);
        const size = sopa.size;
        const cellMm = Math.max(5, Math.min(10, Math.floor(168 / size)));
        const fs = Math.max(3.5, cellMm - 4);
        gridHtml = '<table class="ws-grid" style="border-collapse:collapse;margin:6px auto 2px;">';
        for (let r = 0; r < size; r++) {
          gridHtml += '<tr>';
          for (let c = 0; c < size; c++) {
            gridHtml += '<td style="width:' + cellMm + 'mm;height:' + cellMm + 'mm;text-align:center;vertical-align:middle;border:1px solid #8a91a0;font-size:' + fs + 'mm;font-weight:700;font-family:\'Plus Jakarta Sans\',sans-serif;">' + (sopa.grid[r][c] || '') + '</td>';
          }
          gridHtml += '</tr>';
        }
        gridHtml += '</table>';
      }
      cuerpo += '<div class="ws-sec ws-sopa"><h4>Sopa de letras</h4>' + wsImg(b.imagen_url, b.fuente) + '<p class="ws-words">' + b.palabras.map(esc).join(' · ') + '</p>' + gridHtml + '<p class="ws-hint">Busca y rodea las palabras.</p></div>';
    } else if (b.tipo === 'relacionar' && b.pares && b.pares.length) {
      const modo = b.modo || 'emparejar';
      const der = (typeof shuffleArr === 'function' ? shuffleArr(b.pares.map((p) => p.der || '')) : b.pares.map((p) => p.der || ''));
      const izqHtml = b.pares.map((p) => {
        const img = (modo === 'escribir' && p.izq_img) ? `<div class="ws-item-img"><img src="${esc(p.izq_img)}" alt=""></div>` : '';
        return '<div class="ws-item">' + img + esc(p.izq || '') + '</div>';
      }).join('');
      cuerpo += '<div class="ws-sec ws-rel"><h4>Relaciona cada pareja (dibuja una línea)</h4>' + wsImg(b.imagen_url, b.fuente) + '<div class="ws-cols"><div class="ws-col">' + izqHtml + '</div><div class="ws-col">' + der.map((t) => '<div class="ws-item">' + esc(t) + '</div>').join('') + '</div></div></div>';
    } else if (b.tipo === 'ordenar' && b.items && b.items.length) {
      cuerpo += '<div class="ws-sec"><h4>Ordena los pasos (numéralos del 1 al N)</h4>' + wsImg(b.imagen_url, b.fuente);
      b.items.forEach((it, k) => { cuerpo += '<div class="ws-line"><span class="ws-n">' + (k + 1) + '.</span> ____ ' + esc(it) + '</div>'; });
      cuerpo += '</div>';
    } else if (b.tipo === 'completar' && b.frases && b.frases.length) {
      cuerpo += '<div class="ws-sec"><h4>Completa las frases</h4>' + wsImg(b.imagen_url, b.fuente);
      b.frases.forEach((f, k) => { cuerpo += '<div class="ws-line"><span class="ws-n">' + (k + 1) + '.</span> ' + esc((f.texto || '').replace(/___/g, '______')) + '</div>'; });
      cuerpo += '</div>';
    } else if (b.tipo === 'calculo_mental' && b.sumas && b.sumas.length) {
      cuerpo += '<div class="ws-sec"><h4>Cálculo mental</h4>' + wsImg(b.imagen_url, b.fuente);
      b.sumas.forEach((s2, k) => { cuerpo += '<div class="ws-line"><span class="ws-n">' + (k + 1) + '.</span> ' + (Number(s2.a) || 0) + ' + ' + (Number(s2.b) || 0) + ' = ______</div>'; });
      cuerpo += '</div>';
    } else if (b.tipo === 'mapa_mundi' && b.paises && b.paises.length) {
      const recon = (b.paises || []).map(p => String(p).trim()).filter(Boolean).filter(p => window.MAPA_MUNDI && MAPA_MUNDI.paises[p]);
      cuerpo += '<div class="ws-sec ws-mapa"><h4>Localiza en el mapamundi</h4>' + wsImg(b.imagen_url, b.fuente) + '<div class="ws-map-wrap" data-mapa="1" data-paises="' + esc(JSON.stringify(recon)) + '"></div><p class="ws-words">' + recon.map(esc).join(' · ') + '</p><p class="ws-hint">Busca cada país en el mapamundi y señálalo.</p></div>';
    } else if (b.tipo === 'mapa_espana' && b.objetivos && b.objetivos.length) {
      const modoPdf = b.modo === 'comunidades' ? 'comunidades autónomas' : 'provincias';
      cuerpo += '<div class="ws-sec ws-mapa"><h4>Localiza en el mapa de España (' + modoPdf + ')</h4>' + wsImg(b.imagen_url, b.fuente) + '<p class="ws-words">' + b.objetivos.map(esc).join(' · ') + '</p><p class="ws-hint">Colorea o numera cada zona en un mapa de España.</p></div>';
      b.objetivos.forEach((o, k) => { cuerpo += '<div class="ws-line"><span class="ws-n">' + (k + 1) + '.</span> ' + esc(o) + '</div>'; });
    } else if (b.tipo === 'esquema') {
      const esquema = b.esquema || b.escena || b;
      const elementos = Array.isArray(esquema.elementos) ? esquema.elementos : [];
      const etiquetas = elementos.map(e => e.texto || e.aria_label || e.accion?.titulo).filter(Boolean);
      cuerpo += '<div class="ws-sec ws-esquema"><h4>' + esc(b.titulo || 'Esquema interactivo') + '</h4>' + wsImg(b.imagen_url, b.fuente) + '<p class="ws-hint">Observa el esquema y escribe qué representa cada elemento señalado.</p>' + (etiquetas.length ? '<div class="ws-words">Elementos: ' + etiquetas.map(esc).join(' · ') + '</div>' : '') + '<div class="ws-answer-box">Respuesta y explicación:<br><br>____________________________________________________________________<br><br>____________________________________________________________________<br><br>____________________________________________________________________</div></div>';
    } else if (b.tipo) {
      const titulo = b.titulo || b.nombre || String(b.tipo).replace(/_/g, ' ');
      const instrucciones = b.instrucciones || b.descripcion || b.texto || '';
      cuerpo += '<div class="ws-sec"><h4>' + esc(titulo) + '</h4>' + (instrucciones ? '<div class="ws-richtext">' + formatearTextoJugador(instrucciones) + '</div>' : '') + '<p class="ws-hint">Actividad para realizar en papel: sigue las instrucciones y completa el espacio.</p><div class="ws-answer-box">Respuesta:<br><br>____________________________________________________________________<br><br>____________________________________________________________________</div></div>';
    }
  };
  if (unidadesPdf.length) {
    unidadesPdf.forEach((n, i) => {
      cuerpo += '<div class="ws-unit"><div class="ws-unit-header">__PJ_UNIT_HEADER__</div><h3>Unidad ' + (i + 1) + (n.titulo ? ' — ' + esc(n.titulo) : '') + '</h3>';
      const desc = obtenerContenidoTextoPJ(n);
      if (desc) cuerpo += '<div class="ws-richtext ws-unit-desc">' + formatearTextoJugador(desc) + '</div>';
      let nb = Array.isArray(n.bloques) ? n.bloques : (n.contenido && Array.isArray(n.contenido.bloques) ? n.contenido.bloques : []);
      if (!nb.length && n.contenido && n.contenido.tipo) nb = [n.contenido];
      nb.forEach(imprimirBloque);
      if (Number(n.recompensa || 0)) cuerpo += '<p class="ws-reward">Recompensa de la unidad: +' + Number(n.recompensa) + ' Pz</p>';
      cuerpo += '</div>';
    });
  } else {
    bloques.forEach(imprimirBloque);
  }
  // Portada de la actividad (16:9) en el worksheet
  let portada = '';
  const portadaPdf = a.portada_url || a.portadaUrl || a.contenido?.__rspPortadaUrl || a.contenido?.__rsp_portada_url || '';
  if (portadaPdf) portada = `<div class="ws-cover"><img src="${esc(portadaPdf)}" alt="${esc(a.titulo)}"></div>`;
  else {
    const url = await generarCaratula({ cat: a.categoria, tit: a.titulo, tipo: a.tipo });
    if (url) portada = `<div class="ws-cover"><img src="${url}" alt="${esc(a.titulo)}"></div>`;
  }
  const ws = document.getElementById('print-worksheet');
  cuerpo = cuerpo.replaceAll('__PJ_UNIT_HEADER__', `${portada}<div class="ws-meta">Nombre y apellidos: ________________________________&nbsp;&nbsp; Fecha: _______________&nbsp;&nbsp; Puntos: ________</div>`);
  // El color de la asignatura acompaña a toda la ficha imprimible.
  ws.dataset.color = categoriaColor(a.categoria || '');
  ws.innerHTML = `
    <div class="ws-head">
      <div class="ws-brand"><img class="ws-logo" src="img/PJ-COLOR-LOGO.png" alt="Placeta Junior" /></div>
      <h1>${esc(a.titulo)}</h1>
      <p>${esc(a.categoria)} · Edad ${esc(a.edad_recomendada || '6-12')} · Dificultad ${esc(a.dificultad || 'media')}</p>
    </div>
    ${portada}
    <div class="ws-meta">Nombre: _______________&nbsp;&nbsp; Fecha: _______________&nbsp;&nbsp; Puntos: ________</div>
    ${cuerpo}
    <div class="ws-foot">© Placeta Junior 2026 · junior.laplaceta.org · Prohibida su comercialización · Solo para uso personal y docente.</div>`;
  // Dibuja el mapamundi (world-atlas) en los bloques de mapa_mundi
  const mapaEls = ws.querySelectorAll('[data-mapa="1"]');
  for (const el of mapaEls) {
    let paises = [];
    try { paises = JSON.parse(el.dataset.paises || '[]'); } catch (e) { /* ok */ }
    const url = await generarMapaPdf(paises, 800);
    el.innerHTML = url
      ? '<img src="' + url + '" alt="Mapamundi">'
      : '<div class="ws-msg">Mapamundi no disponible.</div>';
  }
  // No lanzar la impresión hasta que navegador haya descargado y decodificado
  // todas las imágenes remotas (incluidas las de Wikimedia).
  await Promise.all([...ws.querySelectorAll('img')].map(img => new Promise(resolve => {
    img.loading = 'eager';
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = img.onerror = () => resolve();
    setTimeout(resolve, 8000);
  })));
  // Asegurar que las tipografías nuevas (Fredoka One / Outfit) estén cargadas para imprimir
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('800 20px "Fredoka One"'),
        document.fonts.load('400 14px "Outfit"')
      ]);
    }
  } catch (e) { /* sin tipografías web */ }
  cargaPdf.remove();
  window.print();
}

// Dibuja el mapamundi (world-atlas) en un canvas para la ficha PDF
// Dibuja un mapamundi en BLANCO (solo contornos, sin colores) para colorear/señalar en el PDF
async function generarMapaPdf(paises, W) {
  try {
    if (!window.MAPA_MUNDI) return '';
    await MAPA_MUNDI.cargarTodo(); // asegura que topojson esté cargado
    const geo = await MAPA_MUNDI.cargarGeo();
    if (!geo || !geo.features) return '';
    W = W || 900;
    const H = Math.round(W / 2);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const px = (lon) => ((lon + 180) / 360) * W;
    // Proyección Web Mercator (la misma del mapa interactivo de Leaflet): nada de "aplastado"
    const py = (lat) => {
      const r = lat * Math.PI / 180;
      const t = Math.log(Math.tan(Math.PI / 4 + r / 2));
      return Math.max(0, Math.min(H, (0.5 - t / (2 * Math.PI)) * H));
    };
    // Fondo océano (igual que el mapa interactivo)
    ctx.fillStyle = '#a9d0f5'; ctx.fillRect(0, 0, W, H);
    const dibujar = (coords) => {
      ctx.beginPath();
      coords.forEach((ring) => {
        ring.forEach(([lon, lat], k) => {
          const x = px(lon), y = py(lat);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      });
      ctx.fillStyle = '#dbeafe'; ctx.fill();
      ctx.strokeStyle = '#b6c2d9'; ctx.lineWidth = 1; ctx.stroke();
    };
    geo.features.forEach((f) => {
      const nm = f.properties && f.properties.name;
      if (nm === 'Antarctica' || nm === 'Fr. S. Antarctic Lands') return; // evita la franja de la Antártida
      if (f.geometry.type === 'Polygon') dibujar(f.geometry.coordinates);
      else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => dibujar(p));
    });
    return cv.toDataURL('image/png');
  } catch (e) { return ''; }
}

let TODAS = []; // todas las actividades públicas
let actividadPendiente = null;

function abrirCodigoActividad() { const m = document.getElementById('codigo-actividad-modal'); if (m) { m.hidden = false; document.getElementById('codigo-actividad-input')?.focus(); } }
function cerrarCodigoActividad() { const m = document.getElementById('codigo-actividad-modal'); if (m) m.hidden = true; }
async function usarCodigoActividad() {
  const input = document.getElementById('codigo-actividad-input'); const error = document.getElementById('codigo-actividad-error');
  const codigo = String(input?.value || '').trim().toUpperCase(); if (!codigo) return;
  if (sessionStorage.getItem('pj-used-code-' + codigo)) { if (error) { error.textContent = 'Este código ya se ha usado en esta sesión.'; error.classList.remove('hidden'); } return; }
  try {
    const dip = localStorage.getItem('pj-dip') || '';
    const r = await fetch(`${API_BASE}/codigos/canjear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, dip, origen: 'web' }) });
    const data = await r.json(); if (!r.ok || !data.success) throw new Error(data.error || 'Código no válido');
    cerrarCodigoActividad();
    const id = data.actividadIds?.[0]; if (!id) throw new Error('El código no contiene actividades');
    // La autorización vive solo en esta sesión del navegador y caduca al salir.
    sessionStorage.setItem('pj-used-code-' + codigo, '1');
    sessionStorage.setItem('pj-code-' + id, codigo);
    await abrirActividad(id, false);
  } catch (e) { if (error) { error.textContent = e.message || 'Código no válido'; error.classList.remove('hidden'); } }
}

function obtenerUnidadesActividad(a) {
  const c = a && a.contenido;
  const raw = (a && (a.subapartados || a.niveles)) || (c && (c.niveles || c.diapositivas)) || [];
  return Array.isArray(raw) ? raw.slice().sort((x, y) => Number(x.orden || 0) - Number(y.orden || 0)) : [];
}

// ── Clasificar / filtrar por edad ──────────────────────────────────
let filtroEdad = 'todas'; // 'todas' | '0-5' | '6-8' | '9-12' | '13+'
function edadMinima(a) {
  const m = String(a.edad_recomendada || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
function edadCumple(a, banda) {
  const e = edadMinima(a);
  if (banda === 'todas') return true;
  if (e === null) return false;
  if (banda === '0-5') return e <= 5;
  if (banda === '6-8') return e >= 6 && e <= 8;
  if (banda === '9-12') return e >= 9 && e <= 12;
  if (banda === '13+') return e >= 13;
  return true;
}
function setFiltroEdad(val, el) {
  filtroEdad = val;
  document.querySelectorAll('.ef-btn').forEach(b => b.classList.toggle('active', b === el));
  renderPopulares();
  renderCategorias();
  actualizarContadorEdad();
}
function actualizarContadorEdad() {
  const c = document.getElementById('edad-count');
  if (!c) return;
  const n = TODAS.filter(a => edadCumple(a, filtroEdad)).length;
  c.textContent = n + (n === 1 ? ' actividad' : ' actividades');
}

function esPago(a) { return (a.precio_licencia > 0 || a.precio_intento > 0); }
function esBloqueada(a) { return esPago(a) && !a.subvencionada; }
const PJ_APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=org.laplaceta.placetajunior';

function cerrarBloqueoPlacetas() {
  document.getElementById('pj-placetas-lock')?.remove();
}
function mostrarBloqueoPlacetas() {
  cerrarBloqueoPlacetas();
  const modal = document.createElement('div');
  modal.id = 'pj-placetas-lock';
  modal.className = 'pj-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'pj-placetas-lock-title');
  modal.innerHTML = `<div class="pj-modal-card pj-placetas-lock-card"><button type="button" class="pj-modal-close" onclick="cerrarBloqueoPlacetas()" aria-label="Cerrar">×</button><span class="material-symbols-rounded pj-placetas-lock-icon" aria-hidden="true">lock</span><h2 id="pj-placetas-lock-title">Actividad limitada mediante Placetas</h2><p>El equipo de Placeta Junior ha limitado el acceso a esta actividad mediante <strong>Placetas</strong>. Puedes desbloquearla desde la app de Placeta Junior.</p><a class="btn btn-primary" href="${PJ_APP_DOWNLOAD_URL}" target="_blank" rel="noopener">Descargar Placeta Junior</a><button type="button" class="btn btn-outline" onclick="cerrarBloqueoPlacetas()">Cerrar</button></div>`;
  document.body.appendChild(modal);
  modal.querySelector('.pj-modal-close')?.focus();
}

function unidadInicialGuardada(id, unidades) {
  if (!window.PJPartidas || !unidades.length) return 0;
  const partidas = window.PJPartidas.leer ? window.PJPartidas.leer() : {};
  let ultima = null;
  unidades.forEach((_, indice) => {
    const partida = partidas[`${id}::unidad::${indice}`];
    if (partida && (!ultima || Number(partida.guardado || 0) >= Number(ultima.partida.guardado || 0))) ultima = { indice, partida };
  });
  if (!ultima) return 0;
  if (ultima.partida.completada && ultima.indice + 1 < unidades.length) return ultima.indice + 1;
  return ultima.indice;
}

// ═══════════════════════════════════════════════════════════════════
//  CARGA + FILAS POR CATEGORÍA
// ═══════════════════════════════════════════════════════════════════
async function cargarTodo() {
  const banner = document.getElementById('error-banner');
  try {
    // Si hay un DIP guardado (sesión web), se envía para que el DIP demo
    // (16381756J) pueda ver además las actividades "en revisión".
    let url = '/actividades?solo_publicas=1';
    try {
      const dipSesion = localStorage.getItem('pj-dip') || '';
      if (dipSesion) url += '&dip=' + encodeURIComponent(dipSesion);
    } catch (e) { /* sin almacenamiento */ }
    const data = await apiGet(url);
    TODAS = data.actividades || [];
  } catch (e) {
    banner.textContent = 'No se pudieron cargar las actividades. Inténtalo de nuevo en unos instantes.';
    banner.classList.remove('hidden');
  }
  renderPopulares();
  renderCategorias();
  actualizarContadorEdad();
}

// ⭐ Populares: las más jugadas (fila horizontal)
function renderPopulares() {
  const row = document.getElementById('populares-row');
  const ordenadas = [...TODAS].filter(a => edadCumple(a, filtroEdad)).sort((a, b) =>
    (b.estadisticas?.veces_realizada || 0) - (a.estadisticas?.veces_realizada || 0)
  ).slice(0, 10);
  row.innerHTML = ordenadas.length
    ? ordenadas.map(cardActividad).join('')
    : '<div class="empty">Todavía no hay actividades publicadas. ¡Pronto llegarán! 🚀</div>';
  generarCaratulasEn(row);
}

// 🗂️ Una fila horizontal por categoría (deslizable): gratis y de pago mezcladas
function renderCategorias() {
  const cont = document.getElementById('categorias');
  const filtradas = TODAS.filter(a => edadCumple(a, filtroEdad));
  const cats = [...new Set(filtradas.map(a => a.categoria).filter(Boolean))];
  if (cats.length === 0) { cont.innerHTML = ''; return; }
  cont.innerHTML = cats.map(cat => {
    const lista = filtradas.filter(a => a.categoria === cat);
    if (lista.length === 0) return '';
    return `
      <div class="cat-section">
        <h3 class="cat-title" data-color="${categoriaColor(cat)}"><span class="t-ico material-symbols-rounded">${categoriaIcono(cat)}</span> ${escapeHtml(cat)}</h3>
        <div class="h-row">${lista.map(cardActividad).join('')}</div>
      </div>`;
  }).join('');
  cont.querySelectorAll('.cat-section .h-row').forEach(sec => generarCaratulasEn(sec));
}

// Abrir y JUGAR la actividad publicada (reproductor de la web)
async function abrirActividad(id, bloqueada) {
  if (bloqueada) {
    mostrarBloqueoPlacetas();
    return;
  }
  try {
    // Enviar el DIP de sesión para que el DIP demo pueda ver las actividades en revisión.
    let url = `/actividades/${id}`;
    try {
      const dipSesion = localStorage.getItem('pj-dip') || '';
      if (dipSesion) url += '?dip=' + encodeURIComponent(dipSesion);
    } catch (e) { /* sin almacenamiento */ }
    const data = await apiGet(url);
    if (data.actividad) {
      if (esBloqueada(data.actividad)) { mostrarBloqueoPlacetas(); return; }
      // Las actividades organizadas en diapositivas/unidades NUNCA se
      // reproducen todas juntas: se abre el selector de unidad para jugar
      // una a una (flujo esperado, igual que en la app).
      if (obtenerUnidadesActividad(data.actividad).length > 0) {
        cerrarDetalle();
        if (!TODAS.some(x => x.id === data.actividad.id)) TODAS.push(data.actividad);
        const unidades = obtenerUnidadesActividad(data.actividad);
        abrirUnidad(data.actividad.id, unidadInicialGuardada(data.actividad.id, unidades));
        return;
      }
      // La navegación a una actividad siempre cierra la vista anterior.
      cerrarDetalle();
      // El anuncio es una pantalla previa: no puede quedar superpuesto al juego.
      if (mostrarAnuncioActividad(data.actividad)) {
        actividadPendiente = data.actividad;
        return;
      }
      // El player maneja todos los tipos (incluido Placeta Junior Code).
      if (typeof abrirJuego === 'function') { window.__pjUnidadContext = null; abrirJuego(data.actividad); }
      else juniorAviso('No se pudo iniciar el juego.', 'error');
    } else {
      juniorAviso('No se encontró la actividad.', 'error');
    }
  } catch (e) {
    juniorAviso('No se pudo cargar la actividad. Inténtalo de nuevo.', 'error');
  }
}

// Abre únicamente una unidad: su estado local y su puntuación quedan aislados
// de las demás unidades de la misma actividad.
async function abrirUnidad(id, indice) {
  try {
    const data = await apiGet(`/actividades/${id}`);
    const a = data.actividad;
    if (!a) throw new Error('Actividad no encontrada');
    if (esBloqueada(a)) { mostrarBloqueoPlacetas(); return; }
    const unidades = obtenerUnidadesActividad(a), u = unidades[Number(indice)];
    if (!u) throw new Error('Unidad no encontrada');
    const unidadIndex = Number(indice);
    if (unidadIndex > 0 && !(window.PJPartidas && window.PJPartidas.estaCompletada(`${id}::unidad::${unidadIndex - 1}`))) {
      juniorAviso('🔒 Completa la diapositiva anterior para continuar.', 'error');
      return;
    }
    const contenido = { ...(a.contenido || {}) };
    let bloques = Array.isArray(u.bloques) ? u.bloques : (u.contenido && Array.isArray(u.contenido.bloques) ? u.contenido.bloques : []);
    if (!bloques.length && u.contenido && u.contenido.tipo) bloques = [u.contenido];
    delete contenido.niveles; delete contenido.diapositivas; contenido.bloques = bloques;
    const unidad = { ...a, contenido, titulo: `${a.titulo} · Unidad ${unidadIndex + 1}`, recompensa: Number(u.recompensa || 0), _unidadIndex: unidadIndex, _actividadId: a.id };
    // Contexto para la pantalla final: saber si queda una unidad siguiente.
    window.__pjUnidadContext = { id: a.id, indice: unidadIndex, total: unidades.length };
    cerrarDetalle();
    if (mostrarAnuncioActividad(unidad)) {
      actividadPendiente = unidad;
      return;
    }
    abrirJuego(unidad);
  } catch (e) { juniorAviso('No se pudo abrir la unidad. Inténtalo de nuevo.', 'error'); }
}

// ¿Queda una unidad/diapositiva siguiente en la misma actividad?
function pjHaySiguienteUnidad() {
  try {
    const ctx = window.__pjUnidadContext;
    if (!ctx || !ctx.id) return false;
    if (ctx.total != null) return (ctx.indice + 1) < Number(ctx.total);
    const a = TODAS.find(x => x.id === ctx.id);
    return !!a && (ctx.indice + 1 < obtenerUnidadesActividad(a).length);
  } catch (e) { return false; }
}
// Botón de la pantalla final: abre la siguiente unidad/diapositiva.
function pjIrSiguienteUnidad() {
  try {
    const ctx = window.__pjUnidadContext;
    if (!ctx || !ctx.id || !pjHaySiguienteUnidad()) return;
    abrirUnidad(ctx.id, ctx.indice + 1);
  } catch (e) { /* sin catálogo */ }
}

function cerrarAnuncioActividad() {
  const modal = document.getElementById('actividad-anuncio-modal');
  if (modal) modal.hidden = true;
  const pendiente = actividadPendiente;
  actividadPendiente = null;
  if (pendiente && typeof abrirJuego === 'function') abrirJuego(pendiente);
}

// Anuncio común para vídeos y retos semanales. Se aceptan tanto columnas
// nuevas como metadatos dentro de contenido para convivir con el esquema
// actual de Supabase.
function mostrarAnuncioActividad(a) {
  const c = a?.contenido || {};
  const activo = a?.video_popup_activo ?? c.video_popup_activo;
  const semanal = a?.es_reto_semanal ?? c.es_reto_semanal;
  const fin = a?.fecha_fin_reto ?? c.fecha_fin_reto;
  const ahora = Date.now();
  const finMs = fin ? Date.parse(fin) : NaN;
  const retoVisible = semanal && (!Number.isFinite(finMs) || finMs >= ahora);
  const horizontal = window.matchMedia?.('(orientation: landscape)').matches;
  const video = horizontal
    ? (a?.video_url_horizontal || c.video_url_horizontal)
    : (a?.video_url_vertical || c.video_url_vertical);
  if (!((activo && video) || retoVisible)) return false;
  const modal = document.getElementById('actividad-anuncio-modal');
  const out = document.getElementById('actividad-anuncio-contenido');
  if (!modal || !out) return false;
  const fecha = fin && Number.isFinite(finMs) ? new Date(finMs).toLocaleString('es-ES') : '';
  out.innerHTML = video && activo
    ? `<h2>🎬 ${escapeHtml(a.titulo || 'Vídeo')}</h2><video class="pj-anuncio-video" src="${escapeHtml(video)}" controls playsinline></video>${retoVisible ? `<p class="pj-reto-aviso">🏆 Reto semanal activo${fecha ? ` hasta el ${escapeHtml(fecha)}` : ''}. ¡Tu resultado contará para el reto!</p>` : ''}`
    : `<h2>🏆 Reto de la semana</h2><p>${escapeHtml(a.titulo || 'Hay un nuevo reto disponible')}</p><p class="pj-reto-aviso">Puedes clasificar hasta ${escapeHtml(fecha || 'la fecha indicada en la actividad')}. Después la clasificación queda cerrada.</p>`;
  modal.hidden = false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════
//  INIT (incluye rutas propias: /?id= detalle y /?jugar= juego)
// ═══════════════════════════════════════════════════════════════════

// ── Pantalla de carga: se oculta cuando la web está lista ──────────
function ocultarCarga() {
  const el = document.getElementById('pj-loading');
  if (!el) return;
  el.classList.add('oculto');
  // Se retira del DOM tras la transición para no bloquear scroll ni clics.
  setTimeout(() => el.remove(), 500);
}

document.addEventListener('DOMContentLoaded', () => {
  // Las tarjetas también se pueden abrir con teclado, igual que con clic.
  document.addEventListener('keydown', (e) => {
    const card = e.target.closest?.('.card[role="button"]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); card.click(); }
  });
  // Barra superior: efecto al hacer scroll (menos transparencia + sombra)
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  cargarTodo().then(() => {
    ocultarCarga();
    const p = new URLSearchParams(location.search);
    if (p.get('jugar')) abrirActividad(p.get('jugar'), false);
    else if (p.get('id')) verInfo(p.get('id'));
  }).catch(() => ocultarCarga());
  // Seguridad: nunca dejar la pantalla de carga bloqueando la web.
  setTimeout(ocultarCarga, 5000);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarDetalle();
  });
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(location.search);
    if (!p.get('id') && !p.get('jugar')) {
      cerrarDetalle();
      document.body.classList.remove('mostrando-juego');
    } else if (p.get('id')) {
      document.body.classList.remove('mostrando-juego');
      verInfo(p.get('id'));
    } else if (p.get('jugar')) {
      document.body.classList.remove('mostrando-detalle');
      abrirActividad(p.get('jugar'), false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Insignia de nivel en la portada (progreso local, como la app)
// ═══════════════════════════════════════════════════════════════════
function actualizarNivelBadge() {
  const el = document.getElementById('nivel-badge');
  if (!el || !window.PJProgreso) return;
  const p = PJProgreso.estado();
  el.hidden = p.verdes === 0 && p.xp === 0;
  el.innerHTML = `<span class="nb-ico material-symbols-rounded">emoji_events</span>
    <span class="nb-nivel">Nivel ${p.nivel}</span>
    <span class="nb-bar"><span class="nb-fill" style="width:${Math.round(p.pct * 100)}%"></span></span>
    <span class="nb-sub">faltan ${p.paraSiguiente} Pz</span>`;
  const poner = (id, valor) => { const nodo = document.getElementById(id); if (nodo) nodo.textContent = valor; };
  poner('pj-profile-level', p.nivelXP);
  poner('pj-profile-xp', `${p.xp} XP`);
  poner('pj-profile-xp-next', `${p.xpParaSiguiente} XP para el siguiente nivel`);
  const xpFill = document.getElementById('pj-profile-xp-fill');
  if (xpFill) xpFill.style.width = `${Math.round(p.xpPct * 100)}%`;
  poner('pj-profile-coins', p.monedas);
  poner('pj-profile-wins', p.victorias);
  poner('pj-profile-correct', p.verdes);
  poner('pj-profile-missed', p.rojos);
  const ponerEtiquetas = (id, items, vacio, transformar = x => x) => {
    const contenedor = document.getElementById(id);
    if (!contenedor) return;
    contenedor.replaceChildren();
    if (!items.length) { contenedor.textContent = vacio; return; }
    items.forEach(item => { const tag = document.createElement('span'); tag.className = 'pj-progress-tag'; tag.textContent = transformar(item); contenedor.appendChild(tag); });
  };
  ponerEtiquetas('pj-profile-medals', p.medallas, 'Aún no hay medallas.');
  ponerEtiquetas('pj-profile-skills', p.habilidadesDominadas, 'Sigue practicando para desbloquear habilidades.', s => s.replaceAll('_', ' '));
}
if (document.readyState !== 'loading') actualizarNivelBadge();
else document.addEventListener('DOMContentLoaded', actualizarNivelBadge);
window.addEventListener('pj:progreso', actualizarNivelBadge);
