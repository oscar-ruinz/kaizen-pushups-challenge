# Push-ups Challenge

Reto personal de lagartijas con interfaz **retro arcade**: cada día del año hay que hacer tantas lagartijas como número de día (día 1 = 1, día 100 = 100, etc.). El progreso se guarda en una base de datos PostgreSQL y se muestra en un cabinete arcade con scanlines, neón y tipografía pixel-art.

![estado](https://img.shields.io/badge/status-en%20producción-39ff14?style=flat-square)
![backend](https://img.shields.io/badge/backend-FastAPI-009485?style=flat-square)
![frontend](https://img.shields.io/badge/frontend-HTML%2FCSS%2FJS-ffdd00?style=flat-square)
![db](https://img.shields.io/badge/db-PostgreSQL-336791?style=flat-square)
![deploy](https://img.shields.io/badge/deploy-Dokploy-ff10f0?style=flat-square)

---

## Estructura del repositorio

```
PROD/
├── Backend/         # API FastAPI + PostgreSQL
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile
│   └── README.md
├── Frontend/        # SPA estática + Nginx
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── Dockerfile
│   └── README.md
├── README.md        # (este archivo)
└── DEPLOY.md        # Tutorial completo Hostinger + Dokploy
```

---

## Arquitectura

```
┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│   Frontend (Nginx)   │  HTTPS  │   Backend (FastAPI)  │   TCP   │   PostgreSQL         │
│   app.dominio.com    │ ──────> │   api.dominio.com    │ ──────> │   (Hostinger / VPS)  │
│   Dokploy + Docker   │         │   Dokploy + Nixpacks │         │                      │
└──────────────────────┘         └──────────────────────┘         └──────────────────────┘
        ▲                                  ▲
        │ DNS A record                     │ DNS A record
        │                                  │
        └──────────── Hostinger DNS ───────┘
                  (apunta a la IP del VPS de Dokploy)
```

| Componente | Tecnología | Puerto interno |
|---|---|---|
| Frontend | HTML + CSS + JS estático servido por Nginx | `80` |
| Backend  | Python 3 + FastAPI + Uvicorn | `8000` |
| Base de datos | PostgreSQL (esquema `personal`) | `5432` |
| Reverse proxy | Traefik (incluido en Dokploy) | `80` / `443` |

---

## Backend — API REST

API minimalista con dos endpoints. Lee y actualiza una sola fila por día en la tabla `personal."PushUpsChallenge"`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/api/today` | Devuelve `day_number`, `target_count` y `current_count` del día actual |
| `POST` | `/api/add`   | Suma lagartijas al conteo del día (sin pasar de la meta) |
| `GET`  | `/docs`      | Documentación Swagger interactiva |

Esquema de la tabla:

```sql
CREATE TABLE IF NOT EXISTS personal."PushUpsChallenge" (
    record_date   DATE PRIMARY KEY,
    day_number    INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0
);
```

Ver detalles en [Backend/README.md](Backend/README.md).

---

## Frontend — UI retro arcade

Sitio estático sin frameworks: tres archivos (`index.html`, `styles.css`, `app.js`). Estética CRT + neón con tipografías `Press Start 2P` y `VT323`. Totalmente responsive (móvil, tablet, escritorio, landscape).

Características:

- Anillo de progreso SVG con animación pixelada (`steps(20)`).
- Botones de incremento rápido (`+10`, `+15`, `+20`) y entrada custom.
- Optimistic UI: la pantalla se actualiza al instante y revierte si la API falla.
- LEDs animados, scanlines, sombras neón, mensaje **STAGE CLEARED** al alcanzar la meta.

Ver detalles en [Frontend/README.md](Frontend/README.md).

---

## Cómo correrlo en local

### Backend

```powershell
cd Backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# crea un .env con POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
uvicorn main:app --reload --port 8000
```

Documentación interactiva en `http://localhost:8000/docs`.

### Frontend

Abre [Frontend/index.html](Frontend/index.html) directamente en el navegador, o sirve la carpeta con cualquier servidor estático:

```powershell
cd Frontend
python -m http.server 8080
```

Para que apunte al backend local, usa el query parameter:

```
http://localhost:8080/?api=http://localhost:8000
```

---

## Despliegue en producción

El despliegue completo (DNS en Hostinger + aplicaciones en Dokploy + HTTPS con Let's Encrypt) está documentado paso a paso en:

➡️ **[DEPLOY.md](DEPLOY.md)** — Tutorial completo

Cubre:

1. Preparar dominios y subdominios en Hostinger.
2. Configurar registros DNS apuntando al VPS de Dokploy.
3. Crear las aplicaciones de Backend y Frontend en Dokploy.
4. Variables de entorno y secretos.
5. HTTPS automático con Let's Encrypt.
6. Verificación, troubleshooting y errores comunes.

---

## Licencia

Proyecto personal — uso libre para aprender o adaptar.
