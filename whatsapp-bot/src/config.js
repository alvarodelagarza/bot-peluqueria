// Configuración del negocio. Ajusta servicios, horarios y reglas aquí.
module.exports = {
  negocio: {
    nombre: process.env.NOMBRE_NEGOCIO || 'Peluquería Demo',
    direccion: process.env.DIRECCION_NEGOCIO || 'Monterrey, N.L.',
    telefono: process.env.TELEFONO_NEGOCIO || '',
    zonaHoraria: 'America/Monterrey',
  },

  // duracion en minutos, precio en MXN
  servicios: [
    { id: 'corte', nombre: 'Corte de cabello', duracion: 30, precio: 150 },
    { id: 'barba', nombre: 'Arreglo de barba', duracion: 30, precio: 100 },
    { id: 'corte_barba', nombre: 'Corte + barba', duracion: 60, precio: 220 },
    { id: 'tinte', nombre: 'Tinte', duracion: 90, precio: 450 },
  ],

  // 0 = domingo ... 6 = sábado. null = cerrado
  horario: {
    0: null,
    1: ['10:00', '19:00'],
    2: ['10:00', '19:00'],
    3: ['10:00', '19:00'],
    4: ['10:00', '19:00'],
    5: ['10:00', '19:00'],
    6: ['10:00', '15:00'],
  },

  // Hora de comida (nadie atiende). null para desactivar
  descanso: ['14:00', '15:00'],

  // Cada cuánto se ofrecen horarios (minutos)
  intervaloMin: 30,

  // Cuántos días hacia adelante se puede agendar
  diasAdelante: 7,

  // Minutos mínimos de anticipación para agendar el mismo día
  anticipacionMin: 60,

  // Cuántas citas simultáneas se aceptan (sillas / estilistas)
  sillas: 1,

  // Si el cliente no responde en este tiempo, la conversación se reinicia
  sesionExpiraMin: 30,
};
