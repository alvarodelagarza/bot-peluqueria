// Utilidades de fecha/hora sin dependencias. Las fechas se manejan como 'YYYY-MM-DD'
// y las horas como minutos desde medianoche (ej. 10:30 -> 630).
const cfg = require('./config');

function ahora() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: cfg.negocio.zonaHoraria,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    minutos: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10),
  };
}

const aDate = (fecha) => new Date(`${fecha}T12:00:00Z`);

function sumarDias(fecha, n) {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const diaSemana = (fecha) => aDate(fecha).getUTCDay();

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function aHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// 630 -> '10:30 am'
function hora12(min) {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// 'Lunes 6 de octubre'
function fechaLarga(fecha) {
  const f = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return cap(f.format(aDate(fecha)).replace(',', ''));
}

// 'Lun 6 oct'
function fechaCorta(fecha) {
  const d = aDate(fecha);
  const dia = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short' }).format(d).replace('.', '');
  const mes = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', month: 'short' }).format(d).replace('.', '');
  return `${cap(dia)} ${d.getUTCDate()} ${mes}`;
}

module.exports = { ahora, sumarDias, diaSemana, aMinutos, aHHMM, hora12, fechaLarga, fechaCorta };
