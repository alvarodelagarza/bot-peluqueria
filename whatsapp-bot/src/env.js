// Carga variables desde .env sin dependencias externas.
const fs = require('fs');
const path = require('path');

const archivo = path.resolve(process.cwd(), '.env');
if (fs.existsSync(archivo)) {
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

// node:sqlite avisa que es "experimental"; funciona bien, solo silenciamos ese aviso
const emitir = process.emitWarning;
process.emitWarning = (w, ...args) => {
  if (String(w?.message || w).includes('SQLite')) return;
  return emitir.call(process, w, ...args);
};
