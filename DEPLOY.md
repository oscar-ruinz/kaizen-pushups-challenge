# DEPLOY — Push-ups Challenge

Tutorial completo para desplegar **Backend (FastAPI)** y **Frontend (Nginx estático)** en producción usando **Hostinger** (dominio + DNS) y **Dokploy** (PaaS auto-hospedado en un VPS) con **HTTPS automático** vía Let's Encrypt.

> Tiempo estimado: 30–45 minutos la primera vez.
> Coste: 1 dominio en Hostinger + 1 VPS con Dokploy ya instalado.

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Arquitectura del despliegue](#2-arquitectura-del-despliegue)
3. [Preparar la base de datos PostgreSQL](#3-preparar-la-base-de-datos-postgresql)
4. [Configurar DNS en Hostinger](#4-configurar-dns-en-hostinger)
5. [Desplegar el Backend en Dokploy](#5-desplegar-el-backend-en-dokploy)
6. [Desplegar el Frontend en Dokploy](#6-desplegar-el-frontend-en-dokploy)
7. [Activar HTTPS con Let's Encrypt](#7-activar-https-con-lets-encrypt)
8. [Verificación end-to-end](#8-verificación-end-to-end)
9. [Operación diaria](#9-operación-diaria)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Pre-requisitos

Antes de empezar necesitas:

| Recurso | Detalle |
|---|---|
| Dominio en Hostinger | Ej. `midominio.com` con acceso al panel **hPanel** |
| VPS con Dokploy | Instalado y accesible vía `https://IP:3000` o panel propio |
| IP pública del VPS | La encuentras en hPanel → VPS → Información, o `curl ifconfig.me` desde el VPS |
| Repositorio Git | GitHub, GitLab o Bitbucket — uno para Backend y otro para Frontend (o un monorepo) |
| PostgreSQL accesible | Puede ser el del propio VPS, otro servidor de Hostinger o un servicio gestionado |

Subdominios que usaremos:

- `api.midominio.com` → Backend (FastAPI)
- `app.midominio.com` → Frontend (Nginx)

> Puedes usar `midominio.com` directo para el frontend si lo prefieres. La guía asume subdominios.

---

## 2. Arquitectura del despliegue

```
                        Internet
                           │
                           ▼
              ┌──────────────────────────┐
              │   Hostinger DNS          │
              │   midominio.com          │
              │   api.midominio.com  ─┐  │
              │   app.midominio.com  ─┤  │
              └──────────────────────┼──┘
                                     │  (A records → IP del VPS)
                                     ▼
              ┌──────────────────────────┐
              │   VPS con Dokploy        │
              │   ┌────────────────────┐ │
              │   │ Traefik (80/443)   │ │  ← HTTPS + routing
              │   └────────┬───────────┘ │
              │            │             │
              │   ┌────────┴────────┐    │
              │   ▼                 ▼    │
              │ Frontend         Backend │
              │ Nginx :80        FastAPI │
              │ (Dockerfile)     :8000   │
              │                  (Nixpacks)
              └──────────────┬───────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   :5432         │
                    └─────────────────┘
```

---

## 3. Preparar la base de datos PostgreSQL

Antes de tocar el backend, deja lista la base de datos.

### 3.1 Crear esquema y tabla

Conéctate a tu PostgreSQL (con `psql`, DBeaver, pgAdmin, etc.) y ejecuta:

```sql
CREATE SCHEMA IF NOT EXISTS personal;

CREATE TABLE IF NOT EXISTS personal."PushUpsChallenge" (
    record_date   DATE PRIMARY KEY,
    day_number    INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0
);
```

### 3.2 Sembrar las filas del año

El backend lee una fila por día. Necesitas que la fila del día de hoy exista o `/api/today` devolverá `500`. La forma más rápida es insertar todas las filas del año de golpe:

```sql
INSERT INTO personal."PushUpsChallenge" (record_date, day_number, current_count)
SELECT
    d::date                                AS record_date,
    EXTRACT(DOY FROM d)::int               AS day_number,
    0                                      AS current_count
FROM generate_series(
    DATE '2026-01-01',
    DATE '2026-12-31',
    INTERVAL '1 day'
) AS d
ON CONFLICT (record_date) DO NOTHING;
```

Ajusta el año al que estés corriendo el reto.

### 3.3 Crear un usuario sólo para la app

No uses `postgres` en producción. Crea un usuario con permisos mínimos:

```sql
CREATE USER pushups_app WITH PASSWORD 'una-contraseña-larga-y-aleatoria';
GRANT USAGE ON SCHEMA personal TO pushups_app;
GRANT SELECT, UPDATE ON personal."PushUpsChallenge" TO pushups_app;
```

Anota host, puerto, base de datos, usuario y contraseña — los usarás en el paso 5.

### 3.4 Permitir conexiones desde el VPS

Si la base de datos vive en otro servidor:

- Edita `pg_hba.conf` y añade la IP del VPS de Dokploy.
- Edita `postgresql.conf` con `listen_addresses = '*'` (o la IP concreta).
- Abre el puerto `5432` en el firewall **sólo** para la IP del VPS.

Verifica desde el VPS:

```bash
nc -zv tu-host-db 5432
```

---

## 4. Configurar DNS en Hostinger

### 4.1 Entrar al editor DNS

1. Inicia sesión en [hpanel.hostinger.com](https://hpanel.hostinger.com).
2. Ve a **Dominios** → selecciona `midominio.com`.
3. Pulsa **DNS / Nameservers** en el menú lateral.

### 4.2 Añadir los registros A

Crea dos registros tipo **A** apuntando a la IP pública de tu VPS:

| Tipo | Nombre | Apunta a (IP del VPS) | TTL |
|---|---|---|---|
| `A` | `api` | `203.0.113.42` | `3600` |
| `A` | `app` | `203.0.113.42` | `3600` |

> Si quieres usar el dominio raíz (`midominio.com`) en lugar de `app`, crea también: `A` con nombre `@` apuntando a la misma IP.

### 4.3 Esperar propagación

Comprueba que la resolución funciona desde tu máquina:

```powershell
nslookup api.midominio.com
nslookup app.midominio.com
```

Ambos deben devolver la IP del VPS. La propagación suele tardar entre 1 y 30 minutos. Hasta que `nslookup` no devuelva la IP correcta, Let's Encrypt no podrá emitir certificados.

---

## 5. Desplegar el Backend en Dokploy

### 5.1 Preparar el repositorio del backend

El repo debe tener en su raíz:

```
main.py
requirements.txt
Procfile
```

(Si tu monorepo tiene `Backend/` como subcarpeta, en Dokploy podrás indicar **Build Path** = `Backend/`.)

### 5.2 Crear el proyecto en Dokploy

1. Entra al panel de Dokploy.
2. **Projects → Create Project** → nombre: `pushups-challenge`.
3. Dentro del proyecto: **Create Service → Application**.
4. Nombre del servicio: `backend`.

### 5.3 Conectar el repositorio

1. En la pestaña **General**, sección **Provider**, elige **GitHub** (o GitLab/Bitbucket).
2. Autoriza Dokploy si es la primera vez.
3. Selecciona el repositorio y la rama (`main`).
4. Si es monorepo, en **Build Path** pon `Backend`.

### 5.4 Configurar el build

En la pestaña **Build**:

- **Build Type**: `Nixpacks`
- Nixpacks detectará Python, instalará `requirements.txt` y leerá el `Procfile`.
- Si no detectara el `Procfile`, añade en variables de entorno:
  `NIXPACKS_START_CMD=uvicorn main:app --host 0.0.0.0 --port 8000`

### 5.5 Variables de entorno

En la pestaña **Environment**:

```env
POSTGRES_HOST=tu-host-db
POSTGRES_PORT=5432
POSTGRES_DB=tu_db
POSTGRES_USER=pushups_app
POSTGRES_PASSWORD=la-contraseña-del-paso-3.3
PYTHONUNBUFFERED=1
```

Guarda. Dokploy las inyectará al contenedor.

### 5.6 Dominio del backend

En la pestaña **Domains → Add Domain**:

| Campo | Valor |
|---|---|
| Host | `api.midominio.com` |
| Path | `/` |
| Container Port | `8000` |
| HTTPS | (lo activamos en el paso 7) |

### 5.7 Lanzar el deploy

Pulsa **Deploy**. Abre **Deployments → Logs** y espera ver algo como:

```
Uvicorn running on http://0.0.0.0:8000
Application startup complete.
```

Verifica que responde:

```powershell
curl http://api.midominio.com/api/today
```

Debe devolver un JSON con `day_number`, `target_count` y `current_count`.

---

## 6. Desplegar el Frontend en Dokploy

### 6.1 Configurar la URL de la API en `app.js`

Antes de subir el frontend, edita [Frontend/app.js](Frontend/app.js):

```js
const API_BASE_URL = "https://api.midominio.com";
```

Haz commit y push.

> Alternativa sin tocar código: usar el query param `?api=https://api.midominio.com` al abrir la URL.

### 6.2 Crear el servicio en Dokploy

1. Dentro del proyecto `pushups-challenge`: **Create Service → Application**.
2. Nombre del servicio: `frontend`.

### 6.3 Conectar el repositorio

Igual que con el backend: provider Git, repositorio, rama. Si es monorepo, **Build Path** = `Frontend`.

### 6.4 Configurar el build

En la pestaña **Build**:

- **Build Type**: `Dockerfile`
- **Dockerfile Path**: `Dockerfile` (en la raíz del Build Path)

Dokploy usará el `Dockerfile` que sirve los estáticos con Nginx.

### 6.5 Dominio del frontend

En la pestaña **Domains → Add Domain**:

| Campo | Valor |
|---|---|
| Host | `app.midominio.com` |
| Path | `/` |
| Container Port | `80` |

### 6.6 Lanzar el deploy

Pulsa **Deploy**. En los logs verás Nginx arrancar:

```
nginx: [notice] start worker processes
```

Abre `http://app.midominio.com` y deberías ver el cabinete arcade con el contador a `0 / N LAGARTIJAS`.

---

## 7. Activar HTTPS con Let's Encrypt

Dokploy usa Traefik por debajo, que pide certificados a Let's Encrypt automáticamente.

### 7.1 Pre-requisitos

- Los registros DNS del paso 4 ya resuelven a la IP del VPS.
- El puerto `80` del VPS está abierto al mundo (Let's Encrypt usa el desafío HTTP-01).

### 7.2 Activar HTTPS en cada dominio

Para `backend` y `frontend`, en la pestaña **Domains**, en cada entrada de dominio:

1. Activa el toggle **HTTPS**.
2. En **Certificate Provider** elige `Let's Encrypt`.
3. (Opcional) Activa **Force HTTPS Redirect** para que `http://` redirija a `https://`.

Guarda. Traefik emitirá el certificado en segundos. Si tarda más de un minuto, revisa el [troubleshooting](#10-troubleshooting).

### 7.3 Verificar

```powershell
curl -I https://api.midominio.com/api/today
curl -I https://app.midominio.com
```

Ambos deben devolver `200` con un certificado válido. En el navegador verás el candado verde.

---

## 8. Verificación end-to-end

1. Abre `https://app.midominio.com` en el navegador.
2. La UI carga la fecha y la meta del día (`day_number = día del año`).
3. Pulsa `+10`. El anillo se rellena y el contador sube.
4. Recarga la página. El progreso persiste (viene de la base de datos vía backend).
5. Comprueba en la BD:

   ```sql
   SELECT * FROM personal."PushUpsChallenge" WHERE record_date = CURRENT_DATE;
   ```

   El valor de `current_count` coincide con lo que ves en la UI.

6. Abre `https://api.midominio.com/docs` y prueba `POST /api/add` desde Swagger.

Si los cinco pasos funcionan, el despliegue está completo.

---

## 9. Operación diaria

### Redespliegue tras un commit

Dokploy puede redesplegar de tres formas:

- **Manual**: pestaña **Deployments → Redeploy**.
- **Webhook**: copia la URL de **Deployments → Webhook** y pégala en GitHub → *Settings → Webhooks*. Cada push a `main` redesplegará.
- **Auto Deploy**: activa el toggle **Auto Deploy** en la pestaña **General**.

### Ver logs en vivo

**Deployments → Logs** (build) y **Monitoring → Logs** (runtime). El backend imprime errores SQL con stack trace gracias a `PYTHONUNBUFFERED=1`.

### Backups de la base de datos

Programa un `pg_dump` diario, por ejemplo con un cron en el propio VPS:

```bash
0 3 * * * pg_dump -h tu-host -U pushups_app -d tu_db -t personal.\"PushUpsChallenge\" \
  | gzip > /backups/pushups-$(date +\%F).sql.gz
```

### Rotar la contraseña de la base de datos

1. Cambia la contraseña en PostgreSQL con `ALTER USER pushups_app WITH PASSWORD '…'`.
2. Actualiza `POSTGRES_PASSWORD` en Dokploy → **Environment** del servicio `backend`.
3. **Redeploy** el backend.

---

## 10. Troubleshooting

### El frontend muestra `0 / -- LAGARTIJAS`

- `API_BASE_URL` en `app.js` no apunta al backend correcto, o el commit no se desplegó.
- Abre la consola del navegador (F12 → Network) y revisa la llamada a `/api/today`: si es `4xx`/`5xx`, mira los logs del backend.

### Error CORS en la consola del navegador

El backend tiene `allow_origins=["*"]` por defecto, así que esto no debería pasar. Si lo restringiste, asegúrate de incluir `https://app.midominio.com` en `main.py:18-23`.

### `500 — Error leyendo datos`

- Falta la fila del día en la tabla → ejecuta el seeder del paso 3.2.
- Credenciales incorrectas → revisa variables de entorno en Dokploy.
- BD inaccesible desde el VPS → comprueba `nc -zv host 5432` y reglas de firewall.

### Let's Encrypt no emite el certificado

- DNS aún no propaga → espera o usa `dig +short api.midominio.com`.
- Puerto `80` cerrado en el VPS → ábrelo (`ufw allow 80/tcp` o equivalente).
- Demasiados intentos fallidos → Let's Encrypt te bloquea 1 h. Espera y reintenta.
- Logs de Traefik desde el panel del VPS: `docker logs dokploy-traefik`.

### `502 Bad Gateway` en el backend

- El contenedor crasheó al arrancar → mira **Deployments → Logs**.
- **Container Port** del dominio no es `8000` → corrígelo en **Domains**.
- Procfile mal escrito o no detectado → añade `NIXPACKS_START_CMD` como variable de entorno.

### El backend arranca pero `GET /docs` da `404`

Probablemente Traefik está enrutando al servicio equivocado. Verifica que el dominio `api.midominio.com` esté asociado **solo** al servicio `backend` y no aparezca también en `frontend`.

### El despliegue del frontend tarda y falla

Si el `Dockerfile` es el de la carpeta `Frontend/` (`FROM nginx:alpine` + `COPY . /usr/share/nginx/html`), el build debería tardar < 30 s. Si falla, suele ser por **Build Path** mal indicado: confirma que apunta a la carpeta que contiene el `Dockerfile`.

---

## Resumen rápido (checklist)

- [ ] Tabla `personal."PushUpsChallenge"` creada y sembrada con las filas del año.
- [ ] Usuario `pushups_app` con permisos mínimos.
- [ ] Registros DNS `api` y `app` apuntando al VPS y propagados.
- [ ] Servicio `backend` en Dokploy con Nixpacks, variables de entorno y dominio `api.midominio.com:8000`.
- [ ] Servicio `frontend` en Dokploy con Dockerfile y dominio `app.midominio.com:80`.
- [ ] `API_BASE_URL` en `app.js` apuntando a `https://api.midominio.com`.
- [ ] HTTPS activado con Let's Encrypt en ambos dominios.
- [ ] `GET /api/today` responde y la UI suma al pulsar `+10`.

Listo: el reto vive en producción.
