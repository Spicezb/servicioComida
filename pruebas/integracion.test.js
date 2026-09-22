const request = require('supertest');
const { execSync } = require('child_process');

async function obtenerToken(username, password) {
    const respuesta = await fetch(
        'http://localhost:8080/realms/servicio-comida-realm/protocol/openid-connect/token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: 'servicio-comida-client',
                username: username,
                password: password,
                grant_type: 'password'
            })
        }
    );
    const datos = await respuesta.json();
    return datos.access_token;
}

async function esperarKeycloak() {
    let disponible = false;
    while (!disponible) {
        try {
            const respuesta = await fetch(
                'http://localhost:8080/realms/servicio-comida-realm'
            );
            if (respuesta.ok) {
                disponible = true;
            }
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));  // Sirve para esperar un segundo
        }
    }
}

describe('Pruebas integradas', () => {

    test('Verificar que el servicio está activo y listo', async () => {
        const respuestaHealth = await request('http://localhost:3000')
            .get('/health');
        expect(respuestaHealth.status).toBe(200);
        expect(respuestaHealth.body.status).toBe('ok');

        const respuestaReady = await request('http://localhost:3000')
            .get('/ready');
        expect(respuestaReady.status).toBe(200);
        expect(respuestaReady.body.status).toBe('ready');
    });

    test('Crear un pedido con un token válido', async () => {
        const token = await obtenerToken('usuario_test', 'password123');
        const pedido = {
            nombre: 'Hamburguesa',
            descripcion: 'Hamburguesa con queso',
            metodo: 'delivery'
        };
        const respuesta = await request('http://localhost:3000')
            .post('/pedido')
            .set('Authorization', `Bearer ${token}`)
            .send(pedido);
        expect(respuesta.status).toBe(201);
        expect(respuesta.body).toHaveProperty('id');
        expect(respuesta.body.nombre).toBe('Hamburguesa');
        expect(respuesta.body.descripcion).toBe('Hamburguesa con queso');
        expect(respuesta.body.metodo).toBe('delivery');
    });

    test('Rechazar solicitudes sin autenticación o sin el rol requerido', async () => {
        const pedido = {
            nombre: 'Pizza',
            descripcion: 'Pizza de queso',
            metodo: 'para_llevar'
        };
        // Solicitud sin token
        const respuestaSinToken = await request('http://localhost:3000')
            .post('/pedido')
            .send(pedido);
        expect(respuestaSinToken.status).toBe(401);

        // Usuario autenticado pero sin el rol requerido
        const token = await obtenerToken('usuario_sin_rol', 'password123');
        const respuestaSinRol = await request('http://localhost:3000')
            .post('/pedido')
            .set('Authorization', `Bearer ${token}`)
            .send(pedido);
        expect(respuestaSinRol.status).toBe(403);
        });

    test('Eliminar un pedido existente correctamente', async () => {
        const token = await obtenerToken('usuario_test', 'password123');
        const pedido = {
            nombre: 'Pizza',
            descripcion: 'Pizza de queso',
            metodo: 'para_llevar'
        };
        // Se crea un pedido para luego eliminarlo
        const respuestaCrear = await request('http://localhost:3000')
            .post('/pedido')
            .set('Authorization', `Bearer ${token}`)
            .send(pedido);
        expect(respuestaCrear.status).toBe(201);

        const idPedido = respuestaCrear.body.id;

        // Se elimina el pedido
        const respuestaEliminar = await request('http://localhost:3000')
            .delete(`/pedido/${idPedido}`)
            .set('Authorization', `Bearer ${token}`);
        expect(respuestaEliminar.status).toBe(204);

        // Se verifica
        const respuestaConsultar = await request('http://localhost:3000')
            .get(`/pedido/${idPedido}`)
            .set('Authorization', `Bearer ${token}`);
        expect(respuestaConsultar.status).toBe(404);
    });

    test('Conservar un pedido después de volver a levantar los contenedores', async () => {
        const tokenAntes = await obtenerToken('usuario_test', 'password123');
        const pedido = {
            nombre: 'Hamburguesa',
            descripcion: 'Hamburguesa con queso para comprobar persistencia',
            metodo: 'delivery'
        };
        const respuestaCrear = await request('http://localhost:3000')
            .post('/pedido')
            .set('Authorization', `Bearer ${tokenAntes}`)
            .send(pedido);
        expect(respuestaCrear.status).toBe(201);

        const idPedido = respuestaCrear.body.id;

        // Se eliminan los contenedores sin eliminar el volumen ya existente
        execSync('docker compose down', {
            stdio: 'inherit'  //Esto sirve para poder observar los resultados del comando externo en la terminal
        });

        // Se vuelven a levantar los servicios
        execSync('docker compose up -d', {
            stdio: 'inherit'
        });

        await esperarKeycloak();
        const tokenDespues = await obtenerToken('usuario_test', 'password123');

        // Se consulta el pedido
        const respuestaConsultar = await request('http://localhost:3000')
            .get(`/pedido/${idPedido}`)
            .set('Authorization', `Bearer ${tokenDespues}`);

        expect(respuestaConsultar.status).toBe(200);
        expect(respuestaConsultar.body.id).toBe(idPedido);
        expect(respuestaConsultar.body.nombre).toBe('Hamburguesa');
        expect(respuestaConsultar.body.descripcion)
            .toBe('Hamburguesa con queso para comprobar persistencia');
        expect(respuestaConsultar.body.metodo).toBe('delivery');
    }, 60000);  // Se utiliza un timeout mayor, ya que esta prueba implica volver a levantar los contenedores

});