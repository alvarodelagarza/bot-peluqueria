// Máquina de estados de la conversación.
// handle() recibe lo que escribió/tocó el cliente y devuelve una lista de mensajes a enviar:
//   { type: 'text', body }
//   { type: 'buttons', body, buttons: [{ id, title }] }          (máx 3 botones, título ≤ 20)
//   { type: 'list', body, button, rows: [{ id, title, description }] } (máx 10 filas, título ≤ 24)
const cfg = require('./config');
const db = require('./db');
const agenda = require('./agenda');
const f = require('./fechas');

const corta = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const normaliza = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const servicioPorId = (id) => cfg.servicios.find((s) => s.id === id);

const sesionNueva = () => ({ estado: 'INICIO', datos: {} });

// ---------- Pantallas ----------

function menu(saludo = true) {
  const body = saludo
    ? `¡Hola! 👋 Bienvenido a *${cfg.negocio.nombre}*.\n¿Qué quieres hacer?`
    : '¿Te ayudo con algo más?';
  return {
    type: 'buttons',
    body,
    buttons: [
      { id: 'agendar', title: 'Agendar cita' },
      { id: 'mis_citas', title: 'Mis citas' },
      { id: 'info', title: 'Horario y ubicación' },
    ],
  };
}

function listaServicios() {
  return {
    type: 'list',
    body: '¿Qué servicio quieres? ✂️',
    button: 'Ver servicios',
    rows: cfg.servicios.map((s) => ({
      id: `srv:${s.id}`,
      title: corta(s.nombre, 24),
      description: `${s.duracion} min · $${s.precio}`,
    })),
  };
}

function listaDias(ses) {
  const srv = servicioPorId(ses.datos.servicio);
  const dias = agenda.diasConLugar(srv.duracion).slice(0, 10);
  if (dias.length === 0) {
    ses.estado = 'INICIO';
    return [{ type: 'text', body: `😕 No tengo lugares para *${srv.nombre}* en los próximos ${cfg.diasAdelante} días.` }, menu(false)];
  }
  ses.estado = 'DIA';
  return [{
    type: 'list',
    body: `*${srv.nombre}*. ¿Qué día te acomoda? 📅`,
    button: 'Ver días',
    rows: dias.map((d) => ({
      id: `dia:${d.fecha}`,
      title: corta(f.fechaLarga(d.fecha), 24),
      description: `${d.libres} horario${d.libres === 1 ? '' : 's'} libre${d.libres === 1 ? '' : 's'}`,
    })),
  }];
}

function listaHoras(ses, desde = 0) {
  const srv = servicioPorId(ses.datos.servicio);
  const libres = agenda.horariosLibres(ses.datos.fecha, srv.duracion);
  if (libres.length === 0) {
    return [{ type: 'text', body: '😕 Ese día ya se llenó. Elige otro:' }, ...listaDias(ses)];
  }
  if (desde >= libres.length) desde = 0;
  const resto = libres.slice(desde);
  const pagina = resto.length > 10 ? resto.slice(0, 9) : resto;
  const rows = pagina.map((m) => ({ id: `hora:${m}`, title: f.hora12(m), description: `Termina ${f.hora12(m + srv.duracion)}` }));
  if (resto.length > 10) rows.push({ id: `mas:${desde + 9}`, title: 'Más tarde ➜', description: 'Ver más horarios' });

  ses.estado = 'HORA';
  return [{
    type: 'list',
    body: `${f.fechaLarga(ses.datos.fecha)}. ¿A qué hora? 🕐`,
    button: 'Ver horarios',
    rows,
  }];
}

function confirmar(ses, telefono) {
  const srv = servicioPorId(ses.datos.servicio);
  const cliente = db.getCliente(telefono);
  ses.estado = 'CONFIRMAR';
  return [{
    type: 'buttons',
    body:
      '*Confirma tu cita:*\n\n' +
      `✂️ ${srv.nombre}\n` +
      `📅 ${f.fechaLarga(ses.datos.fecha)}\n` +
      `🕐 ${f.hora12(ses.datos.inicio)}\n` +
      `👤 ${cliente.nombre}\n` +
      `💵 $${srv.precio}`,
    buttons: [
      { id: 'confirmar', title: 'Confirmar' },
      { id: 'cambiar_hora', title: 'Cambiar horario' },
      { id: 'cancelar', title: 'Cancelar' },
    ],
  }];
}

function misCitas(ses, telefono) {
  const citas = agenda.citasFuturas(telefono);
  if (citas.length === 0) {
    ses.estado = 'INICIO';
    return [{
      type: 'buttons',
      body: 'No tienes citas próximas. ¿Agendamos una?',
      buttons: [{ id: 'agendar', title: 'Agendar cita' }, { id: 'menu', title: 'Menú' }],
    }];
  }
  ses.estado = 'MIS_CITAS';
  return [{
    type: 'list',
    body: `Tienes ${citas.length} cita${citas.length === 1 ? '' : 's'} próxima${citas.length === 1 ? '' : 's'}. Toca una para ver detalles o cancelarla.`,
    button: 'Ver mis citas',
    rows: citas.map((c) => ({
      id: `cita:${c.id}`,
      title: corta(`${f.fechaCorta(c.fecha)} · ${f.hora12(c.inicio)}`, 24),
      description: corta(c.servicio_nombre, 72),
    })),
  }];
}

function info() {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const lineas = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = cfg.horario[d];
    return `${dias[d]}: ${h ? `${f.hora12(f.aMinutos(h[0]))} – ${f.hora12(f.aMinutos(h[1]))}` : 'Cerrado'}`;
  });
  let body = `📍 *${cfg.negocio.nombre}*\n${cfg.negocio.direccion}\n\n🕐 *Horario*\n${lineas.join('\n')}`;
  if (cfg.negocio.telefono) body += `\n\n📞 ${cfg.negocio.telefono}`;
  return [
    { type: 'text', body },
    { type: 'buttons', body: '¿Agendamos?', buttons: [{ id: 'agendar', title: 'Agendar cita' }, { id: 'menu', title: 'Menú' }] },
  ];
}

// ---------- Lógica principal ----------

function procesar(ses, telefono, id, texto) {
  const t = normaliza(texto);

  // Comandos globales (funcionan en cualquier estado)
  if (!id && /^(hola|ola|buen[oa]s|menu|inicio|hi|hello)\b/.test(t)) {
    Object.assign(ses, sesionNueva());
    return [menu(true)];
  }
  if (!id && /^(cancelar|salir|reiniciar)$/.test(t)) id = 'cancelar';
  if (!id && /^(mis citas|citas)$/.test(t)) id = 'mis_citas';
  if (!id && /^(agendar|cita|reservar)$/.test(t)) id = 'agendar';

  if (id === 'menu') { Object.assign(ses, sesionNueva()); return [menu(false)]; }
  if (id === 'agendar') { Object.assign(ses, { estado: 'SERVICIO', datos: {} }); return [listaServicios()]; }
  if (id === 'mis_citas') return misCitas(ses, telefono);
  if (id === 'info') { ses.estado = 'INICIO'; return info(); }
  if (id === 'cancelar' && ses.estado !== 'CITA') {
    const habiaAlgo = ses.estado !== 'INICIO';
    Object.assign(ses, sesionNueva());
    return habiaAlgo ? [{ type: 'text', body: 'Listo, no se agendó nada. 👍' }, menu(false)] : [menu(true)];
  }

  switch (ses.estado) {
    case 'SERVICIO':
      if (id && id.startsWith('srv:') && servicioPorId(id.slice(4))) {
        ses.datos.servicio = id.slice(4);
        return listaDias(ses);
      }
      break;

    case 'DIA':
      if (id && id.startsWith('dia:')) {
        ses.datos.fecha = id.slice(4);
        return listaHoras(ses, 0);
      }
      break;

    case 'HORA':
      if (id && id.startsWith('mas:')) return listaHoras(ses, parseInt(id.slice(4), 10));
      if (id && id.startsWith('hora:')) {
        ses.datos.inicio = parseInt(id.slice(5), 10);
        if (db.getCliente(telefono)) return confirmar(ses, telefono);
        ses.estado = 'NOMBRE';
        return [{ type: 'text', body: '¿A nombre de quién agendo la cita? ✍️' }];
      }
      break;

    case 'NOMBRE':
      if (!id && texto.trim().length >= 2) {
        db.guardarCliente(telefono, corta(texto.trim(), 60));
        return confirmar(ses, telefono);
      }
      return [{ type: 'text', body: 'Escríbeme tu nombre, porfa. 🙂' }];

    case 'CONFIRMAR':
      if (id === 'cambiar_hora') return listaHoras(ses, 0);
      if (id === 'confirmar') {
        const srv = servicioPorId(ses.datos.servicio);
        const cliente = db.getCliente(telefono);
        const citaId = agenda.crearCita({
          telefono, nombre: cliente.nombre, servicio: srv, fecha: ses.datos.fecha, inicio: ses.datos.inicio,
        });
        if (!citaId) {
          return [{ type: 'text', body: '😬 Uy, alguien acaba de ganar ese horario. Elige otro:' }, ...listaHoras(ses, 0)];
        }
        const msg = {
          type: 'text',
          body:
            `✅ *¡Cita confirmada!*\n\n${srv.nombre}\n${f.fechaLarga(ses.datos.fecha)} a las ${f.hora12(ses.datos.inicio)}\n` +
            `📍 ${cfg.negocio.direccion}\n\nSi necesitas cancelar, escribe *mis citas*. ¡Te esperamos, ${cliente.nombre}!`,
        };
        Object.assign(ses, sesionNueva());
        return [msg];
      }
      break;

    case 'MIS_CITAS':
      if (id && id.startsWith('cita:')) {
        const cita = agenda.getCita(parseInt(id.slice(5), 10), telefono);
        if (!cita || cita.estado !== 'confirmada') return misCitas(ses, telefono);
        ses.estado = 'CITA';
        ses.datos.citaId = cita.id;
        return [{
          type: 'buttons',
          body: `✂️ ${cita.servicio_nombre}\n📅 ${f.fechaLarga(cita.fecha)}\n🕐 ${f.hora12(cita.inicio)}`,
          buttons: [{ id: 'cancelar_cita', title: 'Cancelar esta cita' }, { id: 'menu', title: 'Volver al menú' }],
        }];
      }
      break;

    case 'CITA':
      if (id === 'cancelar_cita' || id === 'cancelar') {
        const ok = agenda.cancelarCita(ses.datos.citaId, telefono);
        Object.assign(ses, sesionNueva());
        return [{ type: 'text', body: ok ? '🗑️ Tu cita fue cancelada.' : 'Esa cita ya no estaba activa.' }, menu(false)];
      }
      break;

    default: // INICIO
      return [menu(true)];
  }

  // No se entendió: repetimos la última pantalla
  const ultimo = ses.datos.ultimo || [menu(true)];
  return [{ type: 'text', body: 'No te entendí 🤔. Elige una opción o escribe *menú* para empezar de nuevo.' }, ...ultimo];
}

/**
 * @param {string} telefono  número del cliente (formato de WhatsApp, ej. 5218112345678)
 * @param {{id?: string, texto?: string}} entrada  id = opción tocada; texto = lo que escribió
 */
function handle(telefono, entrada) {
  let ses = db.getSesion(telefono);
  if (!ses || Date.now() - ses.actualizadaEn > cfg.sesionExpiraMin * 60000) ses = sesionNueva();

  let id = entrada.id || null;
  const texto = entrada.texto || '';

  // Permitir contestar con número ("2") en lugar de tocar la opción
  if (!id && /^\d{1,2}$/.test(texto.trim()) && ses.datos.opciones) {
    id = ses.datos.opciones[parseInt(texto.trim(), 10) - 1] || null;
  }

  const salida = procesar(ses, telefono, id, texto);

  // Guardar las opciones mostradas para poder repetirlas o contestar con número
  const interactivos = salida.filter((m) => m.type !== 'text');
  if (interactivos.length) {
    const ult = interactivos[interactivos.length - 1];
    ses.datos.opciones = (ult.buttons || ult.rows).map((o) => o.id);
    ses.datos.ultimo = [ult];
  } else {
    delete ses.datos.opciones;
    if (ses.estado === 'INICIO') delete ses.datos.ultimo;
  }

  db.guardarSesion(telefono, ses);
  return salida;
}

module.exports = { handle };
