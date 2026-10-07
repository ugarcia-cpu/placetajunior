/* ═══════════════════════════════════════════════════════════════════
   PLACETA JUNIOR — Progreso local (niveles por puntos verdes)
   Igual que la app: Nivel = floor(verdes / 50) + 1, con barra de
   progreso "X / 50 para el siguiente nivel". Se guarda en localStorage
   para que el progreso se mantenga entre visitas (como en la app).
   ═══════════════════════════════════════════════════════════════════ */
window.PJProgreso = {
  KEY: 'pj_progreso_web',

  leer: function () {
    try {
      const p = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      return {
        ...p,
        verdes: Number(p.verdes) || 0,
        rojos: Number(p.rojos) || 0,
        jugadas: Number(p.jugadas) || 0,
        xp: Number(p.xp) || 0,
        monedas: Number(p.monedas) || 0,
        victorias: Number(p.victorias) || 0,
        estadisticas: p.estadisticas && typeof p.estadisticas === 'object' ? p.estadisticas : {},
        medallas: Array.isArray(p.medallas) ? p.medallas : [],
        habilidadesDominadas: Array.isArray(p.habilidadesDominadas) ? p.habilidadesDominadas : []
      };
    } catch (e) {
      return { verdes: 0, rojos: 0, jugadas: 0, xp: 0, monedas: 0, victorias: 0, estadisticas: {}, medallas: [], habilidadesDominadas: [] };
    }
  },

  guardar: function (p) {
    try { localStorage.setItem(this.KEY, JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ }
  },

  // Fórmula de nivel de la app: cada 50 puntos verdes se sube de nivel
  nivelDeVerdes: function (verdes) { return Math.floor((Number(verdes) || 0) / 50) + 1; },

  // Suma los puntos de una partida terminada
  sumar: function (verdes, rojos) {
    const p = this.leer();
    p.verdes += Number(verdes) || 0;
    p.rojos += Number(rojos) || 0;
    p.jugadas += 1;
    this.guardar(p);
    return p;
  },

  recompensar: function (recompensa, tipo) {
    const p = this.leer();
    const xp = Math.max(0, Number(recompensa && recompensa.xp) || 0);
    const monedas = Math.max(0, Number(recompensa && recompensa.coins) || 0);
    const clave = String(tipo || 'actividad');
    p.xp += xp;
    p.monedas += monedas;
    p.victorias += 1;
    p.estadisticas.porTipo = p.estadisticas.porTipo || {};
    const registro = p.estadisticas.porTipo[clave] || { victorias: 0, xp: 0, monedas: 0 };
    registro.victorias += 1;
    registro.xp += xp;
    registro.monedas += monedas;
    p.estadisticas.porTipo[clave] = registro;
    p.estadisticas.ultimaVictoria = { tipo: clave, fecha: Date.now() };
    const medallas = [[1, 'Primera victoria'], [5, 'Cinco victorias'], [10, 'Diez victorias']];
    medallas.forEach(([umbral, nombre]) => { if (p.victorias >= umbral && !p.medallas.includes(nombre)) p.medallas.push(nombre); });
    if (registro.victorias >= 5 && !p.habilidadesDominadas.includes(clave)) p.habilidadesDominadas.push(clave);
    this.guardar(p);
    return p;
  },

  // Estado completo: nivel actual y progreso hacia el siguiente
  estado: function () {
    const p = this.leer();
    const nivel = this.nivelDeVerdes(p.verdes);
    const enNivel = p.verdes % 50;
    const paraSiguiente = p.verdes > 0 && enNivel === 0 ? 50 : 50 - enNivel;
    return {
      verdes: p.verdes,
      rojos: p.rojos,
      jugadas: p.jugadas,
      xp: p.xp,
      nivelXP: Math.floor(p.xp / 100) + 1,
      xpEnNivel: p.xp % 100,
      xpParaSiguiente: p.xp > 0 && p.xp % 100 === 0 ? 100 : 100 - (p.xp % 100),
      xpPct: (p.xp % 100) / 100,
      monedas: p.monedas,
      victorias: p.victorias,
      estadisticas: p.estadisticas,
      medallas: p.medallas,
      habilidadesDominadas: p.habilidadesDominadas,
      nivel: nivel,
      enNivel: enNivel,
      paraSiguiente: paraSiguiente,
      pct: enNivel / 50
    };
  }
};
