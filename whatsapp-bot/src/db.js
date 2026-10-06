const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite'); // incluido en Node 22.13+

const dbPath = path.resolve(process.env.DB_PATH || 'data/agenda.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');

// Ejecuta fn dentro de una transacción
function transaccion(fn) {
  return (...args) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn(...args);
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
}

db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    telefono   TEXT PRIMARY KEY,
    nombre     TEXT NOT NULL,
    creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS citas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    telefono        TEXT NOT NULL,
    nombre          TEXT NOT NULL,
    servicio_id     TEXT NOT NULL,
    servicio_nombre TEXT NOT NULL,
    precio          INTEGER,
    fecha           TEXT NOT NULL,     -- YYYY-MM-DD
    inicio          INTEGER NOT NULL,  -- minutos desde medianoche
    fin             INTEGER NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'confirmada', -- confirmada | cancelada
    creada_en       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas (fecha, estado);
  CREATE INDEX IF NOT EXISTS idx_citas_tel ON citas (telefono, estado);

  CREATE TABLE IF NOT EXISTS sesiones (
    telefono       TEXT PRIMARY KEY,
    estado         TEXT NOT NULL,
    datos          TEXT NOT NULL,
    actualizada_en INTEGER NOT NULL
  );
`);

function getSesion(telefono) {
  const row = db.prepare('SELECT * FROM sesiones WHERE telefono = ?').get(telefono);
  if (!row) return null;
  return { estado: row.estado, datos: JSON.parse(row.datos), actualizadaEn: row.actualizada_en };
}

function guardarSesion(telefono, ses) {
  db.prepare(`
    INSERT INTO sesiones (telefono, estado, datos, actualizada_en) VALUES (?, ?, ?, ?)
    ON CONFLICT(telefono) DO UPDATE SET estado = excluded.estado, datos = excluded.datos,
      actualizada_en = excluded.actualizada_en
  `).run(telefono, ses.estado, JSON.stringify(ses.datos), Date.now());
}

function getCliente(telefono) {
  return db.prepare('SELECT * FROM clientes WHERE telefono = ?').get(telefono) || null;
}

function guardarCliente(telefono, nombre) {
  db.prepare(`
    INSERT INTO clientes (telefono, nombre) VALUES (?, ?)
    ON CONFLICT(telefono) DO UPDATE SET nombre = excluded.nombre
  `).run(telefono, nombre);
}

module.exports = { db, transaccion, getSesion, guardarSesion, getCliente, guardarCliente };
