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
- Kind
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

El proyecto cuenta con una suite de pruebas automatizadas utilizando **Jest** para verificar de forma exhaustiva tanto la lógica interna de la aplicación como el comportamiento integrado con el ecosistema de contenedores. Las pruebas se dividen en dos categorías principales localizadas en el directorio `pruebas/`:

### Pruebas Unitarias

Se enfocan en validar funciones aisladas de la aplicación sin interactuar de forma externa con bases de datos ni servicios de autenticación. Evalúan específicamente el archivo `app/app.js`:

* **Validación de Fechas (`esFechaValida`)**:
  * Acepta fechas futuras dentro del rango permitido (formato ISO).
  * Rechaza fechas pasadas de forma estricta.
  * Controla errores devolviendo falso ante formatos de texto incorrectos.

* **Validación de Métodos de Pedido (`metodosValidos`)**:
  * Confirma la aceptación de métodos configurados en las reglas del negocio (ej. `delivery`).
  * Deniega la inserción de métodos no estipulados en los requerimientos del sistema (ej. `express`).

### Pruebas de Integración

Comprueban la interacción real entre la aplicación (Express), el servidor de autenticación (Keycloak) y la persistencia en base de datos (PostgreSQL) usando **Supertest**. 

Para su correcto funcionamiento, implementan dos utilidades asíncronas clave:
* `obtenerToken(username, password)`: Realiza solicitudes POST directamente a Keycloak para adquirir un *Access Token* JWT válido.

* `esperarKeycloak()`: Genera bucles de espera controlados para pausar los tests hasta que el contenedor de Keycloak responda con éxito.

Los escenarios validados son:

* **Verificación de Disponibilidad (Health y Ready)**: Evalúa que los endpoints públicos `/health` y `/ready` respondan correctamente con código `200 OK` y el estado esperado, asegurando la comunicación activa del servidor.

* **Flujo Feliz de Creación**: Valida que un usuario autenticado y con el rol adecuado (`usuario_test`) pueda registrar exitosamente un pedido mediante un método POST en `/pedido`, verificando la integridad de las propiedades de retorno (`id`, `nombre`, `descripcion`, `metodo`) y el código de éxito `201 Created`.

* **Control de Seguridad y Restricciones de Acceso (RBAC)**:
  * Garantiza el rechazo con código `401 Unauthorized` si se intenta interactuar con rutas protegidas sin adjuntar credenciales.
  * Confirma el bloqueo con código `403 Forbidden` si el usuario se autentica correctamente (`usuario_sin_rol`), pero carece de los privilegios o roles del sistema necesarios para operar la ruta.

* **Flujo de Eliminación Correcta**: Simula el ciclo de vida completo creando un registro, ejecutando un método DELETE sobre su identificador, asegurando el código de éxito de eliminación `204 No Content`, y validando posteriormente que una consulta GET al recurso retorne un código `404 Not Found`.

* **Persistencia Robusta ante Caídas**: Inserta un pedido en el sistema, ejecuta comandos de terminal desde Node (`docker compose down`) para apagar y remover los contenedores simulando un fallo crítico de infraestructura. Tras reactivar los servicios de manera aislada (`docker compose up -d`), espera la reestabilización del entorno y consulta la información inicial mediante su identificador único para verificar que los datos persistieron de manera intacta en el volumen Docker asociado. *Nota: Esta prueba cuenta con un timeout extendido a 60 segundos debido a la carga dinámica del ambiente [1].*

### Ejecución de la Suite de Pruebas

Para ejecutar las pruebas en el entorno de desarrollo, asegúrate de tener instaladas las dependencias y corre el siguiente comando dentro del contenedor o en tu terminal configurada:

```bash
npm test -- --verbose 
```


## 9. Estructura del repositorio
 
```
servicioComida/
├── app/.app.js                  # Servicio Express
├── db/                          # Scripts de inicialización de PostgreSQL
│   ├── .01-inicio.sql              
│   └── .02-datos.sql                        
├── kubernetes/
│   ├── base/                    # Deployment, Service, PVC, ConfigMap, Secret
│   └── overlays/local/          # Kustomize overlay
├── pruebas/                     # Pruebas unitarias e integración (Jest)
│   ├── .integracion.test.js               
│   └── .unitarias.test.js             
├── .dockerignore
├── .env.example
├── .gitignore
├── .docker-compose.yml
├── .dockerfile
├── .install-tools.ps1          # Serie de comandos de powershell para instalar kind y kubectl
├── .README.md
├── .realm-export.json          # Configuración de Keycloak (realm, client, roles, usuarios)
├── .start-k8s.ps1              # Serie de comandos de powershell para arrancar kubernetes
└── .stop-k8s.ps1               # Serie de comandos de powershell para parar kubernetes         
```


## 10. Módulo Kubernetes 

El mismo sistema de la sección 1, expresado como manifiestos de Kubernetes y personalizado con Kustomize, para correr en un clúster local de `kind`.

### Correspondencia Compose → Kubernetes

| Compose | Kubernetes | Notas |
|---|---|---|
| `services.app` / `services.postgres_db` / `services.keycloak` | `Deployment` (`servicio-comida-app`, `postgres`, `keycloak`) | Cada Deployment gestiona sus pods y sus reinicios |
| `ports:` | `Service` | Expuestos al host mediante los mapeos de `kubernetes/kind-config.yml`, sin necesidad de `kubectl port-forward` |
| nombre del servicio en la red de Compose | nombre del `Service` de Kubernetes | Kubernetes resuelve por DNS interno igual que Compose por nombre de servicio |
| `volumes: postgres_data` | `PersistentVolumeClaim` | Los datos sobreviven a que el Pod de PostgreSQL se destruya y recree (verificable con `kubectl get pvc`, estado `Bound`) |
| `environment:` con contraseñas | `postgres-secret.yml` / `keycloak-secret.yml`, generados localmente a partir de `postgres-secret.example.yml` / `keycloak-secret.example.yml` | Estos archivos reales **no se versionan**; solo las plantillas `.example.yml` van al repositorio |
| `environment:` sin contraseñas | `ConfigMap` | Configuración no sensible externalizada igual que en Compose |
| `healthcheck:` | `livenessProbe` / `readinessProbe` en cada Deployment | El script `start-k8s.ps1` espera explícitamente a que los tres queden disponibles antes de reportar éxito |
| `container_name:` | *(sin equivalente necesario)* | Kubernetes identifica y enruta por `Service`/`labels`, no por nombre de contenedor |
| `build: .` | *(sin equivalente directo)* | `kind` no construye Dockerfiles: `start-k8s.ps1` hace `docker build` y luego carga la imagen al clúster con `kind load docker-image` |
| `depends_on: condition: service_healthy` | *(sin equivalente directo)* | Kubernetes no bloquea el arranque de un Deployment hasta que otro esté healthy; el `rollout status` de cada Deployment y las probes son lo más cercano, pero no impiden que la app arranque antes de tiempo |
| `docker-compose.yml` completo | `kubectl apply -k kubernetes/overlays/local` | Aplica `base/` con las personalizaciones del overlay |

### Requisitos previos

- Docker Desktop (o Docker Engine) en ejecución
- `kubectl`
- `kind`

En Windows, `install-tools.ps1` verifica e instala lo que falte de esta lista.

### Opción 1 — Ejecución cómoda

Forma recomendada para levantar el entorno local.

**1. Clonar el repositorio**

```powershell
git clone <URL_DEL_REPOSITORIO>
cd servicioComida
```

**2. Preparar los archivos de secretos**

Los archivos con credenciales reales no se versionan en Git. Se crean localmente a partir de las plantillas:

```powershell
Copy-Item kubernetes\base\postgres-secret.example.yml kubernetes\base\postgres-secret.yml
Copy-Item kubernetes\base\keycloak-secret.example.yml kubernetes\base\keycloak-secret.yml
```

Los valores pueden modificarse localmente si se desea.

**3. Instalar/verificar herramientas**

Se recomienda correr el siguiente comando en caso de que powershell requiera ciertos permisos:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

```powershell
.\install-tools.ps1
```

El script verifica la disponibilidad de Docker, `kubectl` y `kind`. Si alguna herramienta acaba de instalarse, puede ser necesario cerrar y volver a abrir PowerShell.

**4. Levantar Kubernetes**

```powershell
.\start-k8s.ps1
```

El script hace, en orden:

1. Verificación de Docker.
2. Creación del clúster `servicio-comida` con `kind`.
3. Construcción de la imagen Docker de la aplicación.
4. Carga de la imagen dentro del clúster.
5. Aplicación del overlay de Kustomize.
6. Espera hasta que PostgreSQL, Keycloak y la aplicación estén disponibles.
7. Muestra los Pods, Services y PersistentVolumeClaims resultantes.

Al terminar:

- Aplicación: `http://localhost:3000`
- Keycloak: `http://localhost:8080`

No es necesario `kubectl port-forward`: el clúster `kind` usa los mapeos de puertos definidos en `kubernetes/kind-config.yml`.

### Opción 2 — Ejecución manual

Muestra explícitamente cada paso que hacen los scripts de la Opción 1.

**1. Clonar el repositorio**

```powershell
git clone <URL_DEL_REPOSITORIO>
cd servicioComida
```

**2. Crear los archivos locales de secretos**

```powershell
Copy-Item kubernetes\base\postgres-secret.example.yml kubernetes\base\postgres-secret.yml
Copy-Item kubernetes\base\keycloak-secret.example.yml kubernetes\base\keycloak-secret.yml
```

**3. Verificar las herramientas**

```powershell
docker --version
kubectl version --client
kind version
docker info    # confirma que Docker Desktop está corriendo
```

**4. Crear el clúster kind**

```powershell
kind create cluster --name servicio-comida --config kubernetes\kind-config.yml
kubectl get nodes    # debe mostrar el nodo en estado Ready
```

**5. Construir la imagen de la aplicación**

```powershell
docker build -t servicio-comida-app:local .
```

**6. Cargar la imagen dentro del clúster kind**

```powershell
kind load docker-image servicio-comida-app:local --name servicio-comida
```

**7. Aplicar Kubernetes con Kustomize**

```powershell
kubectl apply -k kubernetes\overlays\local
```

Crea y configura Deployments, Services, PersistentVolumeClaim, ConfigMaps y Secrets de PostgreSQL, Keycloak y la aplicación.

**8. Esperar a que los Deployments estén disponibles**

```powershell
kubectl rollout status deployment/postgres --timeout=180s
kubectl rollout status deployment/keycloak --timeout=240s
kubectl rollout status deployment/servicio-comida-app --timeout=180s
```

**9. Verificar los Pods**

```powershell
kubectl get pods
```

PostgreSQL, Keycloak y la aplicación deben aparecer en estado `Running`.

**10. Verificar los Services**

```powershell
kubectl get services
```

**11. Verificar la persistencia**

```powershell
kubectl get pvc
```

El PVC de PostgreSQL debe aparecer con estado `Bound`.

### Apagar

```powershell
kind delete cluster --name servicio-comida
```


## 11. Decisiones de Arquitectura

Para el diseño e implementación de este servicio, se priorizó la modularidad, la seguridad robusta, la ligereza del código y la facilidad de despliegue en entornos locales y productivos. A continuación, se detallan los componentes principales seleccionados y la justificación técnica de su elección:

### Tabla de Decisiones Técnicas

| Componente / Capa | Tecnología Seleccionada | ¿Por qué se eligió? |
| :--- | :--- | :--- |
| **Lenguaje y Entorno** | **JavaScript (Node.js + Express)** | Permite un desarrollo rápido, ágil y con un consumo mínimo de recursos en contenedores. Express proporciona un enrutamiento liviano y directo para construir APIs REST sin sobrecarga de código. |
| **Controlador de BD** | **Módulo `pg` (node-postgres)** | Se eligió usar el driver nativo de PostgreSQL en lugar de un ORM pesado (como Sequelize o Prisma). Esto garantiza consultas directas, máxima velocidad de ejecución, menor consumo de memoria y un control absoluto sobre el SQL ejecutado. |
| **Base de Datos** | **PostgreSQL** | Ofrece alta fiabilidad, soporte nativo para tipos de datos complejos (como `TIMESTAMP`) y una integración excelente con Docker mediante scripts de inicialización automáticos (`.sql`). |
| **Autenticación** | **Keycloak (OIDC/JWT)** | Evita implementar lógica de autenticación a mano (*"no reinventar la rueda"*). Centraliza la gestión de usuarios, roles y emisión de tokens (JWT), garantizando un estándar de la industria altamente seguro y desacoplado de la lógica de negocio. |
| **Orquestación Local** | **Docker Compose v2** | Permite levantar todo el ecosistema (App, BD y Auth) de forma idéntica en cualquier máquina con un solo comando. Facilita la persistencia mediante volúmenes independientes del ciclo de vida del contenedor. |
| **Control de Flujo** | **Depends_on + Healthcheck** | En lugar de programar lógica de reintento dentro del código de la aplicación Node.js, delegamos la sincronización en Docker. La app no inicia hasta que la BD y Keycloak reporten estar completamente listos (`service_healthy`). |
| **Framework de Pruebas** | **Jest + Supertest** | Proveen una sintaxis intuitiva y herramientas potentes para ejecutar tanto pruebas unitarias aisladas como pruebas de integración que requieran levantar servicios externos y simular peticiones HTTP reales. |

### Justificación de Diseño Clave

* **Desacoplamiento Absoluto de Credenciales:** La imagen de Docker generada es completamente agnóstica al entorno. No contiene contraseñas, llaves ni secretos en el código fuente; todo se inyecta en tiempo de ejecución a través de variables de entorno (`.env`), cumpliendo con las buenas prácticas de *Twelve-Factor App*.

* **Persistencia Independiente:** Al declarar el volumen `postgres_data` de forma externa a la existencia del contenedor, se garantiza la resiliencia de la información ante fallos lógicos, actualizaciones de la aplicación o reinicios del sistema operativo anfitrión.

* **Seguridad basada en Roles (RBAC):** La aplicación no valida usuarios, solo valida la autenticidad del token y la presencia del rol `usuario`. Esto permite cambiar las políticas de contraseñas o agregar proveedores de identidad en Keycloak en el futuro sin modificar una sola línea de código en la API Express.


## 12. Uso de IA
Durante el desarrollo se utilizaron herramientas de IA como apoyo para explicar conceptos, revisar configuraciones, ayudar en el proceso de redacción técnica pero accesible y detectar posibles errores. Las decisiones, comandos, manifiestos y cambios incorporados al repositorio fueron revisados y comprobados manualmente por el grupo antes de considerarse parte de la solución.
Además se utilizó las herramientas de IA para realizar investigaciones de tecnologías y comandos de manera mas rápida y eficaz, asi evitando entrar a extensas documentaciones y ahorrar tiempo durante el proceso de producción. En síntesis la IA fue un asistente y no el autor del trabajo. 


## 13. Video de Comprobacion
Se adjunta link al video en YouTube en donde se realiza la comprobación de que las especificaciones de la tarea funcionan de manera correcta y las pruebas son exitosas.

* Video: "Comprobacion TCI: Andres_C, Xavier_C y Sebastian_A"
* Link: "https://youtu.be/kwuKsn2xaUI"