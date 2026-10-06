# Bot de WhatsApp – Agenda de citas (peluquería)

Bot que atiende por WhatsApp y agenda citas: el cliente elige servicio, día y hora; el bot valida disponibilidad, guarda la cita y permite consultarla o cancelarla.

- **Cero dependencias**: solo Node.js 22.13 o superior (usa el SQLite y el servidor HTTP que ya trae Node). No hay que correr `npm install`.
- **WhatsApp Cloud API** (la oficial de Meta).
- **SQLite** en `data/agenda.db` (se crea solo).

## Estructura

```
whatsapp-bot/
├── src/
│   ├── index.js         Servidor: webhook de Meta + API /api/citas
│   ├── conversacion.js  Flujo del chat (menú → servicio → día → hora → nombre → confirmar)
│   ├── agenda.js        Disponibilidad, crear/cancelar citas, evita empalmes
│   ├── whatsapp.js      Envío de mensajes (texto, botones, listas)
│   ├── db.js            Tablas: clientes, citas, sesiones
│   ├── config.js        ⚙️ Servicios, precios, horario, comida, sillas
│   ├── fechas.js        Utilidades de fecha (zona America/Monterrey)
│   └── env.js           Lee el archivo .env
├── scripts/simular.js   Simulador en consola (sin WhatsApp)
├── .env.example
└── package.json
```

## 1. Probarlo sin WhatsApp (simulador)

```bash
cd whatsapp-bot
npm run simular
```

Escribe `hola` y contesta con el número de cada opción. Usa una base aparte (`data/simulador.db`).

## 2. Ajustar el negocio

Edita `src/config.js`: servicios (nombre, duración, precio), horario por día, hora de comida, cuántas sillas atienden a la vez, días hacia adelante, anticipación mínima.

## 3. Conectar con WhatsApp (Meta)

1. Entra a <https://developers.facebook.com> → **Crear app** → tipo *Business* → agrega el producto **WhatsApp**.
2. En **WhatsApp → API Setup** copia el **Phone number ID** y genera un **token**. (El token temporal dura 24 h; para producción crea un *System User* en Business Settings con token permanente.)
3. Agrega tu celular como número de prueba para poder recibir mensajes.
4. Copia `.env.example` como `.env` y llena `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `VERIFY_TOKEN` (inventado por ti) y `APP_SECRET`.
5. Arranca el bot: `npm start`
6. Expónlo a internet (Meta necesita HTTPS). Para pruebas:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   # o: ngrok http 3000
   ```
7. En **WhatsApp → Configuration → Webhook**: URL `https://TU-URL/webhook`, el mismo `VERIFY_TOKEN`, y suscríbete al campo **messages**.
8. Mándale "hola" al número de prueba. 🎉

## API para el calendario web

```
GET /api/citas?desde=2026-10-06&hasta=2026-10-13
Authorization: Bearer <ADMIN_TOKEN>
```

Devuelve las citas confirmadas en JSON (con `hora_inicio` / `hora_fin`). Esto lo consumirá el calendario web.

## Notas

- El bot solo puede escribir libremente dentro de las 24 h después del último mensaje del cliente. Para **recordatorios** (ej. un día antes) hay que usar **plantillas aprobadas** por Meta — es el siguiente paso natural.
- Si se configura `APP_SECRET`, se valida la firma de cada webhook (recomendado).
- Si dos clientes eligen el mismo horario, solo el primero en confirmar se lo queda; al segundo se le ofrecen otros.
- Para producción: un VPS o servicio tipo Railway/Render con disco persistente (por el archivo SQLite).

## Pendientes sugeridos

- [ ] Recordatorio automático con plantilla de WhatsApp
- [ ] Calendario web para la peluquería (usa `/api/citas`)
- [ ] Varios estilistas con agenda propia
- [ ] Bloquear días (vacaciones, festivos)
