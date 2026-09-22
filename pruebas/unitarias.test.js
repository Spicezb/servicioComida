const { esFechaValida, metodosValidos } = require('../app/app');

describe('Pruebas unitarias', () => {

    test('Aceptar una fecha válida', () => {  
        const ahora = new Date();
        ahora.setHours(ahora.getHours() + 1);
        expect(esFechaValida(ahora.toISOString())).toBe(true);
    });

    test('Rechazar una fecha que ya pasó', () => {
        const ahora = new Date();
        ahora.setHours(ahora.getHours() - 1);
        expect(esFechaValida(ahora.toISOString())).toBe(false);
    });

    test('Rechazar una fecha con formato incorrecto', () => {
        expect(esFechaValida('fecha-invalida')).toBe(false);
    });

    test('Aceptar un método de pedido válido', () => {
        expect(metodosValidos.includes('delivery')).toBe(true);
    });

    test('Rechazar un método de pedido inválido', () => {
        expect(metodosValidos.includes('express')).toBe(false);
    });

});