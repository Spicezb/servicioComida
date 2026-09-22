const express = require('express');
const { Pool } = require('pg');
const { auth } = require('express-oauth2-jwt-bearer');

const app = express();

app.use(express.json());

// Métodos de forma hardcodeada para la tarea (filtros y validaciones)
const metodosValidos = ['comer_aca', 'para_llevar', 'delivery', 'drive_thru'];

// Función auxiliar para validar que una fecha esté entre el momento actual y 3 días a futuro
const esFechaValida = (fechaString) => {
    if (!fechaString) return false;
    const fechaEvaluar = new Date(fechaString);
    
    // Si el formato de fecha enviado no es válido
    if (isNaN(fechaEvaluar.getTime())) return false;

    const ahora = new Date();
    const limiteFuturo = new Date();
    limiteFuturo.setDate(ahora.getDate() + 3);

    // No se permiten fechas en el pasado ni con más de 3 días en el futuro
    return fechaEvaluar >= ahora && fechaEvaluar <= limiteFuturo;
};

// Se crea la instancia del pool vacia, para que pg busque las varibles 
// de entorno en el sistema y que estas no queden hardcodeadas.
const pool = new Pool();


// CONFIGURACIÓN DE KEYCLOAK PARA DOCKER
const checkJwt = auth({
    audience: process.env.KEYCLOAK_CLIENT_ID, 
    
    // Docker se conecta internamente a esta URL para descargar las llaves públicas
    jwksUri: `http://keycloak:8080/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    
    // Le indicamos que el emisor escrito dentro del token debe ser localhost
    issuer: `http://localhost:8080/realms/${process.env.KEYCLOAK_REALM}`,
    
    tokenSigningAlg: 'RS256'
});

// Middleware para exigir el rol "usuario" o "admin"
const exigirRolPedido = (req, res, next) => {
    const roles = req.auth?.payload?.realm_access?.roles || [];
    console.log('Usuario:', req.auth?.payload?.preferred_username);
    console.log('Roles:', roles);
    if (!roles.includes('usuario') && !roles.includes('admin')) {
        return res.status(403).json({
            status: 'error',
            message: 'No tienes el rol requerido.'
        });
    }
    next();
};


// ------------------------------------------- RUTAS ABIERTAS (No necesitan token ni roles de keycloak) --------------


// GET /health - Verifica que la aplicación esté viva
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});


// GET /ready - Verifica conexión con PostgreSQL (Retorna 503 si falla)
app.get('/ready', (req, res) => {
    pool.query('SELECT 1')
        .then(() => {
            res.status(200).json({
                status: 'ready'
            });
        })
        .catch((err) => {
            res.status(503).json({
                status: 'not ready'
            });
        });
});


// GET /pedidos - Lista todos los pedidos 
app.get('/pedidos', (req, res) => {
    const { metodo } = req.query;

    // Si el usuario envía el filtro, validamos que pertenezca a los métodos válidos
    if (metodo) {
        if (typeof metodo !== 'string' || !metodosValidos.includes(metodo.trim())) {
            return res.status(400).json({
                status: 'error',
                message: `El parámetro metodo para filtrar debe ser uno de los siguientes: ${metodosValidos.join(', ')}.`
            });
        }

        // Consulta filtrada usando parámetros válidos para prevenir SQL Injection
        const queryText = 'SELECT * FROM pedidos WHERE metodo = \$1 ORDER BY id ASC';
        
        return pool.query(queryText, [metodo.trim()])
            .then((result) => {
                res.status(200).json(result.rows);
            })
            .catch((err) => {
                res.status(500).json({ status: 'error' });
            });
    }

    // Si no se envía el parámetro ?metodo=, devuelve todos los pedidos como antes
    pool.query('SELECT * FROM pedidos ORDER BY id ASC')
        .then((result) => {
            res.status(200).json(result.rows);
        })
        .catch((err) => {
            res.status(500).json({ status: 'error' });
        });
});


// ------------------------------------------- RUTAS PROTEGIDAS (Exigen Token y Roles de Keycloak) ----------------------------


// POST /pedido - Crea un pedido respetando la estructura exacta del JSON
app.post('/pedido', checkJwt, exigirRolPedido, (req, res) => {
    const { nombre, descripcion, fecha, metodo } = req.body;

    // Validación de campos requeridos 
    if (!nombre || !descripcion || !metodo) {
        return res.status(400).json({
            status: 'error',
            message: 'Los campos nombre, descripcion y metodo son requeridos.'
        });
    }

    // Validación del método del pedido
    if (typeof metodo !== 'string' || !metodosValidos.includes(metodo.trim())) {
        return res.status(400).json({
            status: 'error',
            message: `El metodo debe ser uno de los siguientes: ${metodosValidos.join(', ')}.`
        });
    }

    // Validación de la fecha si es enviada de forma explícita
    if (fecha && !esFechaValida(fecha)) {
        return res.status(400).json({
            status: 'error',
            message: 'La fecha no puede estar en el pasado ni superar los 3 días a futuro.'
        });
    }

    const queryText = fecha 
        ? 'INSERT INTO pedidos (nombre, descripcion, fecha, metodo) VALUES (\$1, \$2, \$3, \$4) RETURNING *'
        : 'INSERT INTO pedidos (nombre, descripcion, fecha, metodo) VALUES (\$1, \$2, NOW(), \$3) RETURNING *';
    
    const queryParams = fecha 
        ? [nombre, descripcion, fecha, metodo.trim()] 
        : [nombre, descripcion, metodo.trim()];

    pool.query(queryText, queryParams)
        .then((result) => {
            res.status(201).json(result.rows[0]);
        })
        .catch((err) => {
            res.status(500).json({
                status: 'error'
            });
        });
});


// GET /pedido/:id - Consulta un pedido por ID
app.get('/pedido/:id', checkJwt, exigirRolPedido, (req, res) => {
    const { id } = req.params;

    pool.query('SELECT * FROM pedidos WHERE id = \$1', [id])
        .then((result) => {
            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'not found'
                });
            }
            res.status(200).json(result.rows[0]);
        })
        .catch((err) => {
            res.status(500).json({
                status: 'error'
            });
        });
});


// PUT /pedido/:id - Actualiza un pedido completo
app.put('/pedido/:id', checkJwt, exigirRolPedido, (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, fecha, metodo } = req.body;

    if (!nombre || !descripcion || !metodo) {
        return res.status(400).json({
            status: 'error',
            message: 'Los campos nombre, descripcion y metodo son requeridos para actualizar.'
        });
    }

    // Validación del método en la actualización
    if (typeof metodo !== 'string' || !metodosValidos.includes(metodo.trim())) {
        return res.status(400).json({
            status: 'error',
            message: `El metodo debe ser uno de los siguientes: ${metodosValidos.join(', ')}.`
        });
    }

    // Validación de la fecha si es enviada en la modificación
    if (fecha && !esFechaValida(fecha)) {
        return res.status(400).json({
            status: 'error',
            message: 'La fecha no puede estar en el pasado ni superar los 3 días a futuro.'
        });
    }

    const queryText = fecha
        ? 'UPDATE pedidos SET nombre = \$1, descripcion = \$2, fecha = \$3, metodo = \$4 WHERE id = \$5 RETURNING *'
        : 'UPDATE pedidos SET nombre = \$1, descripcion = \$2, metodo = \$3 WHERE id = \$4 RETURNING *';

    const queryParams = fecha
        ? [nombre, descripcion, fecha, metodo.trim(), id]
        : [nombre, descripcion, metodo.trim(), id];

    pool.query(queryText, queryParams)
        .then((result) => {
            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'not found'
                });
            }
            res.status(200).json(result.rows[0]);
        })
        .catch((err) => {
            res.status(500).json({
                status: 'error'
            });
        });
});


// DELETE /pedido/:id - Elimina un pedido (Retorna 204 si se elimina) 
app.delete('/pedido/:id', checkJwt, exigirRolPedido, (req, res) => {
    const { id } = req.params;

    pool.query('DELETE FROM pedidos WHERE id = \$1 RETURNING *', [id])
        .then((result) => {
            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'not found'
                });
            }
            res.status(204).send();
        })
        .catch((err) => {
            res.status(500).json({
                status: 'error'
            });
        });
});

// Middleware global para interceptar errores de Keycloak y dar formatos de errores 401/403 válidos
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError' || err.status === 401) {
        return res.status(401).json({ status: 'error', message: 'Token inválido o ausente.' });
    }
    if (err.status === 403) {
        return res.status(403).json({ status: 'error', message: 'No tienes los permisos ni el rol requerido.' });
    }
    res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
});

// Inicia el server en el puerto 3000 y tira msj de confirmación
app.listen(3000, () => {
    console.log('Servidor corriendo en puerto 3000');
});
