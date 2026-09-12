# servicioComida

## Estudiantes:

Sebastián Aguilar Villalobos, 2025072110
Andrés Campos Montero, 2025069367
Xavier Céspedes Alvarado, 2025102887

## Contexto

Para nuestra tarea vamos a utilizar un servicio para órdenes de comida rápida.

La entidad que utilizaremos será:

{
  "id": int SERIAL PK,
  "nombre": VARCHAR(100),
  "descripcion": VARCHAR(250),
  "fecha": TIMESTAMP,
  "metodo": VARCHAR(50)
}

## Rutas previstas:

| Método |    Ruta     |             Descripción              |
|--------|-------------|--------------------------------------|
| GET    | /health     | Verifica que la aplicación esté viva |
| GET    | /ready      | Verifica conexión con PostgreSQL     |
| POST   | /pedido     | Crea un pedido                       |
| GET    | /pedido/:id | Consulta un pedido                   |
| PUT    | /pedido/:id | Actualiza un pedido                  |
| DELETE | /pedido/:id | Elimina un pedido                    | 
| GET    | /pedidos    | Lista pedidos                        |