const { esFechaValida } = require('../app/app');

test('debe aceptar una fecha válida', () => {
    const ahora = new Date();
    const fechaValida = new Date(ahora);
    fechaValida.setHours(fechaValida.getHours() + 1);

    expect(esFechaValida(fechaValida.toISOString())).toBe(true);
});