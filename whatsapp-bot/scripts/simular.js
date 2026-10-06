// Simulador en consola: prueba la conversación sin WhatsApp ni Meta.
// Uso: npm run simular   (contesta con el número de la opción o escribe texto)
require('../src/env');
process.env.DB_PATH = process.env.SIM_DB_PATH || 'data/simulador.db';

const readline = require('readline');
const conversacion = require('../src/conversacion');

const TEL = process.argv[2] || '5218100000000';

function mostrar(msgs) {
  for (const m of msgs) {
    console.log('\n\x1b[32m🤖 Bot:\x1b[0m ' + m.body.replace(/\n/g, '\n        '));
    const opciones = m.buttons || m.rows || [];
    if (m.type === 'list') console.log(`        [${m.button}]`);
    opciones.forEach((o, i) => {
      console.log(`   ${String(i + 1).padStart(2)}) ${o.title}${o.description ? `  — ${o.description}` : ''}`);
    });
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`Simulador del bot (cliente ${TEL}). Escribe "hola" para empezar, Ctrl+C para salir.`);
rl.setPrompt('\n\x1b[36m🙋 Tú:\x1b[0m ');
rl.prompt();
rl.on('line', (linea) => {
  mostrar(conversacion.handle(TEL, { texto: linea }));
  rl.prompt();
});
