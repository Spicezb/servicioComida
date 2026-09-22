# servicioComida

## Estudiantes:

Sebastián Aguilar Villalobos, 2025072110
Andrés Campos Montero, 2025069367
Xavier Céspedes Alvarado, 2025102887

## 1. Contexto

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

La autenticación no se implementa a mano, se delega en **Keycloak**, que corre como contenedor del mismo `docker-compose.yml`. Las rutas que modifican datos exigen un token de acceso válido (JWT/OIDC) emitido por Keycloak. El servicio solo valida la firma contra las llaves públicas del proveedor.

### Rutas previstas:

| Método |    Ruta     |             Descripción              |
|--------|-------------|--------------------------------------|
| GET    | /health     | Verifica que la aplicación esté viva |
| GET    | /ready      | Verifica conexión con PostgreSQL     |
| POST   | /pedido     | Crea un pedido                       |
| GET    | /pedido/:id | Consulta un pedido                   |
| PUT    | /pedido/:id | Actualiza un pedido                  |
| DELETE | /pedido/:id | Elimina un pedido                    | 
| GET    | /pedidos    | Lista pedidos                        |

## 2. Requisitos previos
 
- Docker Engine 24+
- Docker Compose v2 (`docker compose`, sin guion)
- Puertos libres en el host: `3000` (app), `5432` (PostgreSQL), `8080` (Keycloak)
No se necesita Node.js instalado en el host: la aplicación corre dentro del contenedor.

## 3. docker-compose

En nuestro archivo de docker-compose levantamos los tres servicios (app, PostgreSQL y Keycloak), en este caso, la app depende de que PostgreSQL y Keycloak estén previamente activos antes de poder estar lista, esto lo verificamos con depends_on con la condición de service_healthy, para garantizar el orden de arranque de los servicios.

Decidimos que el depends_on con la condición service_healthy es la opción que mejor se adapta a nuestra tarea, ya que, con esto nos aseguramos de que cuando la app se levante, los otros dos servicios ya estén disponibles, y lo mejor es que de esta forma, las dependencias se gestionan directamente mediante docker, y no se tiene que añadir código extra en la aplicación para implementar esta lógica, manteniendo así las responsabilidades separadas y por lo tanto, la cohesión de la app.

Healthchecks:

El healthcheck de PostgreSQL permite determinar cuando la base de datos está disponible para aceptar conexiones, para esto se utiliza pg_isready, que se encarga de realizar la comprobación sin la necesidad de ejecutar una consulta directamente sobre la tabla. El resultado de este healthcheck es utilizado por la app para la condición de service_healthy en el depends_on.

El healthcheck de la aplicación comprueba que el servidor esté funcionando correctamente al hacer una solicitud al endpoint /health, este es capaz de verificar la disponibilidad del servicio sin requerir de acceso a PostgreSQL.

###  Puesta en marcha (un solo comando)

```bash
git clone https://github.com/Spicezb/servicioComida.git
cd servicioComida
cp .env.example .env
docker compose up --build
```
Lo que se hace con lo anterior es: 

1. Levanta PostgreSQL y crea la tabla `pedidos` automáticamente a partir de `db/01-inicio.sql` (y la llena con datos de ejemplo desde `db/02-datos.sql`).
2. Levanta Keycloak e importa automáticamente el realm `servicio-comida-realm` desde `realm-export.json` (`--import-realm`), con su client, sus roles y dos usuarios de prueba.
3. Construye la imagen de la app, espera a que PostgreSQL y Keycloak estén `healthy` y la levanta en `http://localhost:3000`.

### Apagar el sistema
 
```bash
docker compose down          # detiene y elimina los contenedores, este sí conserva el volumen de datos
docker compose down -v       # además elimina el volumen 
```

## 4. Configuración (variables de entorno)
 
Todas las credenciales, nombres de base de datos, hosts y puertos se inyectan por variables de entorno. **La imagen no contiene ninguna contraseña**: ni en el `dockerfile`, ni en el código de `app.js`, ni en ningún archivo copiado a la imagen. El archivo real `.env` está excluido del repositorio por `.gitignore`; lo único versionado es `.env.example` con valores de ejemplo.

## 5. Rutas finales (que hacen y como dirigirse)

Entidad `pedido`:
 
```json
{
  "id": 1,
  "nombre": "Combo clasico",
  "descripcion": "Hamburguesa con papas",
  "fecha": "2026-09-21T10:00:00.000Z",
  "metodo": "para_llevar"
}
```
 
`metodo` acepta únicamente: `comer_aca`, `para_llevar`, `delivery`, `drive_thru`. `fecha` es opcional al crear/actualizar (si se omite, se usa la fecha/hora actual); si se envía, debe estar entre el momento actual y 3 días a futuro.

### Crear un pedido

POST /pedido

Ejemplo:

{
  "nombre": "Combo clásico",
  "descripcion": "Hamburguesa con papas",
  "metodo": "para_llevar"
}
 
### Rutas 
 
| Método |      Ruta     |       Auth      |                         Body                      |                              Éxito                                |                           Errores                                |
|--------|---------------|-----------------|---------------------------------------------------|-------------------------------------------------------------------|------------------------------------------------------------------|
|  GET   |  `/health`    |      Pública    |                          —                        | `200` `{"status":"ok"}` — no toca la base de datos                |                             —                                    |
|  GET   |  `/ready`     |      Pública    |                          —                        | `200` `{"status":"ready"}` si Postgres responde                   | `503` `{"status":"not ready"}` si no                             |
|  GET   |  `/pedidos`   |      Pública    |                          —                        | `200` con el arreglo de pedidos. Admite filtro `?metodo=delivery` | `400` si `metodo` no es uno de los válidos                       |
|  GET   | `/pedido/:id` | **Token + rol** |                          —                        | `200` con el pedido                                               | `404` si no existe, `401`/`403` según token                      |
|  POST  | `/pedido`     | **Token + rol** | `{ "nombre", "descripcion", "metodo", "fecha"? }` | `201` con el pedido creado                                        | `400` body inválido/incompleto, `401`/`403` según token          |
|  PUT   | `/pedido/:id` | **Token + rol** | `{ "nombre", "descripcion", "metodo", "fecha"? }` | `200` con el pedido actualizado                                   | `400` body inválido, `404` si no existe, `401`/`403` según token |
| DELETE | `/pedido/:id` | **Token + rol** |                          —                        | `204` sin cuerpo                                                  | `404` si no existe, `401`/`403` según token                      |

## 6. Autenticación con Keycloak
 
El realm `servicio-comida-realm` y el client público `servicio-comida-client` se importan automáticamente al arrancar Keycloak, junto con dos usuarios de prueba:
 
|     Usuario       |   Contraseña  |                   Rol                       |
|-------------------|---------------|---------------------------------------------|
| `usuario_test`    | `password123` | `usuario` (puede usar las rutas protegidas) |
| `usuario_sin_rol` | `password123` | sin rol (recibe `403` en rutas protegidas)  |

Para poner a pruba los tokens nostros usamos Bruno (software visto en clase). A continuación se ponen unos comandos dados por IA para la extracción de tokens. De igual manera se puso a prueba para asegurarnos que sirviera:

```bash
curl -X POST "http://localhost:8080/realms/servicio-comida-realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=servicio-comida-client" \
  -d "grant_type=password" \
  -d "username=usuario_test" \
  -d "password=password123"
```

## 7. Persistencia
 
Los datos de PostgreSQL se guardan en el volumen nombrado `postgres_data`, declarado en `docker-compose.yml`. Para comprobar que sobreviven a un reinicio de los contenedores:
 
```bash
# 1. Escribir un dato
curl -X POST http://localhost:3000/pedido \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"nombre":"Persistencia","descripcion":"Prueba de persistencia","metodo":"comer_aca"}'
 
# 2. Bajar los contenedores sin borrar el volumen
docker compose down
 
# 3. Volver a levantar
docker compose up --build
 
# 4. Leer de nuevo (ruta pública, no necesita token)
curl http://localhost:3000/pedidos
```
 
## 8. Pruebas

Parte pendiente por explicar (Xavi)

## 9. Estructura del repositorio
 
```
servicioComida/
├── app/app.js              # Servicio Express
├── db/                     # Scripts de inicialización de PostgreSQL
├── pruebas/                # Pruebas unitarias e integración (Jest)
├── kubernetes/
│   ├── base/                # [pendiente] Deployment, Service, PVC, ConfigMap, Secret
│   └── overlays/            # [pendiente] Kustomize overlay
├── dockerfile
├── docker-compose.yml
├── realm-export.json       # Configuración de Keycloak (realm, client, roles, usuarios)
├── .env.example
├── .dockerignore
└── .gitignore
```

## 10. Kubernetes 
Pendiente de montar

## 11. Uso de IA
Durante el desarrollo se utilizaron herramientas de IA como apoyo para explicar conceptos, revisar configuraciones y detectar posibles errores. Las decisiones, comandos, manifiestos y cambios incorporados al repositorio fueron revisados y comprobados manualmente por el grupo antes de considerarse parte de la solución.