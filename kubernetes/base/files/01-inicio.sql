CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250) NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metodo VARCHAR(50) NOT NULL
        CHECK (metodo IN (
            'comer_aca',
            'para_llevar',
            'delivery',
            'drive_thru'
        ))
);