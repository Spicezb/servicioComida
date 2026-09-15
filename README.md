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

nombre hace referencia al nombre del combo ordenado, y descripción es una especificación más amplia de este.

Dentro de los posibles métodos se encuentran los siguientes:

- para_llevar
- comer_aca
- delivery
- drive_thru

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

## docker-compose

En nuestro archivo de docker-compose levantamos los tres servicios (app, PostgreSQL y Keycloak), en este caso, la app depende de que PostgreSQL y Keycloak estén previamente activos antes de poder estar lista, esto lo verificamos con depends_on con la condición de service_healthy, para garantizar el orden de arranque de los servicios.

Decidimos que el depends_on con la condición service_healthy es la opción que mejor se adapta a nuestra tarea, ya que, con esto nos aseguramos de que cuando la app se levante, los otros dos servicios ya estén disponibles, y lo mejor es que de esta forma, las dependencias se gestionan directamente mediante docker, y no se tiene que añadir código extra en la aplicación para implementar esta lógica, manteniendo así las responsabilidades separadas y por lo tanto, la cohesión de la app.

Healthchecks:

El healthcheck de PostgreSQL permite determinar cuando la base de datos está disponible para aceptar conexiones, para esto se utiliza pg_isready, que se encarga de realizar la comprobación sin la necesidad de ejecutar una consulta directamente sobre la tabla. El resultado de este healthcheck es utilizado por la app para la condición de service_healthy en el depends_on.

El healthcheck de la aplicación comprueba que el servidor esté funcionando correctamente al hacer una solicitud al endpoint /health, este es capaz de verificar la disponibilidad del servicio sin requerir de acceso a PostgreSQL.