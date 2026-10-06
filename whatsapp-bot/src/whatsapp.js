// Envío de mensajes con WhatsApp Cloud API (Meta).
const version = () => process.env.GRAPH_API_VERSION || 'v23.0';

function aPayload(to, msg) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };

  if (msg.type === 'text') {
    return { ...base, type: 'text', text: { body: msg.body, preview_url: false } };
  }
  if (msg.type === 'buttons') {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: msg.body },
        action: { buttons: msg.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
      },
    };
  }
  if (msg.type === 'list') {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: msg.body },
        action: { button: msg.button, sections: [{ title: 'Opciones', rows: msg.rows }] },
      },
    };
  }
  throw new Error(`Tipo de mensaje desconocido: ${msg.type}`);
}

async function enviar(to, msg) {
  const url = `https://graph.facebook.com/${version()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(aPayload(to, msg)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${err}`);
  }
  return res.json();
}

// Marca el mensaje como leído (palomitas azules)
async function marcarLeido(messageId) {
  const url = `https://graph.facebook.com/${version()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(() => {});
}

module.exports = { enviar, marcarLeido, aPayload };
