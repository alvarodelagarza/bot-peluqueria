require('./env');
const http = require('http');
const crypto = require('crypto');
const conversacion = require('./conversacion');
const whatsapp = require('./whatsapp');
const agenda = require('./agenda');
const f = require('./fechas');

// Valida que el webhook realmente venga de Meta (si hay APP_SECRET)
function firmaValida(req, raw) {
  const secret = process.env.APP_SECRET;
  if (!secret) return true;
  const firma = req.headers['x-hub-signature-256'] || '';
  const esperada = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return firma.length === esperada.length && crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada));
}

// Meta reintenta si tardamos; evitamos procesar dos veces el mismo mensaje
const vistos = new Set();
function yaVisto(id) {
  if (vistos.has(id)) return true;
  vistos.add(id);
  if (vistos.size > 1000) vistos.delete(vistos.values().next().value);
  return false;
}

async function procesarMensaje(m) {
  const entrada = {};
  if (m.type === 'text') entrada.texto = m.text.body;
  else if (m.type === 'interactive') entrada.id = m.interactive.button_reply?.id || m.interactive.list_reply?.id;
  else if (m.type === 'button') entrada.texto = m.button.text; // respuestas a plantillas
  else entrada.texto = ''; // audio, imagen, etc. -> mostrará el menú

  console.log(`📩 ${m.from}:`, entrada.id || entrada.texto);
  whatsapp.marcarLeido(m.id);

  const respuestas = conversacion.handle(m.from, entrada);
  for (const r of respuestas) await whatsapp.enviar(m.from, r);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > 1e6) { reject(new Error('Cuerpo demasiado grande')); req.destroy(); }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

function responder(res, status, cuerpo, tipo = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': tipo });
  res.end(cuerpo);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    // 1) Verificación del webhook (Meta hace un GET al configurarlo)
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const q = url.searchParams;
      if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.VERIFY_TOKEN) {
        console.log('✅ Webhook verificado');
        return responder(res, 200, q.get('hub.challenge') || '');
      }
      return responder(res, 403, 'Forbidden');
    }

    // 2) Mensajes entrantes
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const raw = await leerCuerpo(req);
      if (!firmaValida(req, raw)) return responder(res, 401, 'Firma inválida');
      responder(res, 200, 'OK'); // responder rápido; procesamos después

      let body;
      try { body = JSON.parse(raw.toString('utf8')); } catch { return; }
      const cambios = (body.entry || []).flatMap((e) => e.changes || []);
      for (const cambio of cambios) {
        for (const m of cambio.value?.messages || []) {
          if (yaVisto(m.id)) continue;
          procesarMensaje(m).catch((e) => console.error('❌ Error procesando mensaje:', e.message));
        }
      }
      return;
    }

    // 3) API para el calendario web: GET /api/citas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
    if (req.method === 'GET' && url.pathname === '/api/citas') {
      const auth = req.headers.authorization || '';
      if (!process.env.ADMIN_TOKEN || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) return responder(res, 401, 'No autorizado');
      const desde = url.searchParams.get('desde') || f.ahora().fecha;
      const hasta = url.searchParams.get('hasta') || f.sumarDias(desde, 7);
      const citas = agenda.citasPorRango(desde, hasta).map((c) => ({
        ...c, hora_inicio: f.aHHMM(c.inicio), hora_fin: f.aHHMM(c.fin),
      }));
      return responder(res, 200, JSON.stringify(citas), 'application/json; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/') return responder(res, 200, 'Bot de citas activo ✂️');
    return responder(res, 404, 'No encontrado');
  } catch (e) {
    console.error('❌', e.message);
    if (!res.headersSent) responder(res, 500, 'Error');
  }
});

const port = process.env.PORT || 3000;
servidor.listen(port, () => console.log(`🚀 Bot escuchando en http://localhost:${port}`));
