// Reglas de disponibilidad y manejo de citas.
const cfg = require('./config');
const { db, transaccion } = require('./db');
const f = require('./fechas');

// Devuelve los minutos de inicio libres para un servicio de `duracion` en `fecha`.
function horariosLibres(fecha, duracion) {
  const h = cfg.horario[f.diaSemana(fecha)];
  if (!h) return [];

  const abre = f.aMinutos(h[0]);
  const cierra = f.aMinutos(h[1]);
  const hoy = f.ahora();
  if (fecha < hoy.fecha) return [];

  const ocupadas = db
    .prepare("SELECT inicio, fin FROM citas WHERE fecha = ? AND estado = 'confirmada'")
    .all(fecha);
  const descanso = cfg.descanso ? [f.aMinutos(cfg.descanso[0]), f.aMinutos(cfg.descanso[1])] : null;

  const libres = [];
  for (let t = abre; t + duracion <= cierra; t += cfg.intervaloMin) {
    const fin = t + duracion;
    if (fecha === hoy.fecha && t < hoy.minutos + cfg.anticipacionMin) continue;
    if (descanso && t < descanso[1] && fin > descanso[0]) continue;
    const empalmes = ocupadas.filter((o) => t < o.fin && fin > o.inicio).length;
    if (empalmes >= cfg.sillas) continue;
    libres.push(t);
  }
  return libres;
}

// Próximos días que tienen al menos un horario libre.
function diasConLugar(duracion) {
  const hoy = f.ahora().fecha;
  const dias = [];
  for (let i = 0; i < cfg.diasAdelante; i++) {
    const fecha = f.sumarDias(hoy, i);
    const libres = horariosLibres(fecha, duracion).length;
    if (libres > 0) dias.push({ fecha, libres });
  }
  return dias;
}

// Crea la cita revalidando disponibilidad dentro de una transacción
// (por si dos clientes eligieron el mismo horario). Devuelve el id o null.
const crearCita = transaccion(({ telefono, nombre, servicio, fecha, inicio }) => {
  if (!horariosLibres(fecha, servicio.duracion).includes(inicio)) return null;
  const r = db.prepare(`
    INSERT INTO citas (telefono, nombre, servicio_id, servicio_nombre, precio, fecha, inicio, fin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(telefono, nombre, servicio.id, servicio.nombre, servicio.precio, fecha, inicio, inicio + servicio.duracion);
  return Number(r.lastInsertRowid);
});

function citasFuturas(telefono) {
  const hoy = f.ahora();
  return db.prepare(`
    SELECT * FROM citas
    WHERE telefono = ? AND estado = 'confirmada'
      AND (fecha > ? OR (fecha = ? AND inicio >= ?))
    ORDER BY fecha, inicio LIMIT 10
  `).all(telefono, hoy.fecha, hoy.fecha, hoy.minutos);
}

function getCita(id, telefono) {
  return db.prepare('SELECT * FROM citas WHERE id = ? AND telefono = ?').get(id, telefono) || null;
}

function cancelarCita(id, telefono) {
  const r = db.prepare(
    "UPDATE citas SET estado = 'cancelada' WHERE id = ? AND telefono = ? AND estado = 'confirmada'"
  ).run(id, telefono);
  return r.changes > 0;
}

function citasPorRango(desde, hasta) {
  return db.prepare(`
    SELECT * FROM citas WHERE fecha BETWEEN ? AND ? AND estado = 'confirmada'
    ORDER BY fecha, inicio
  `).all(desde, hasta);
}

module.exports = { horariosLibres, diasConLugar, crearCita, citasFuturas, getCita, cancelarCita, citasPorRango };
