# Push-ups Challenge — Backend

API REST construida con **FastAPI** y **PostgreSQL**. Expone dos endpoints para consultar y actualizar el progreso diario del reto de lagartijas.

## Contenido de la carpeta

| Archivo | Descripción |
|---|---|
| `main.py` | Aplicación FastAPI con los dos endpoints de la API |
| `requirements.txt` | Dependencias Python necesarias para ejecutar la app |
| `.env.example` | Plantilla de variables de entorno (copia como `.env` para desarrollo local) |
| `Procfile` | Comando de arranque para Nixpacks / Dokploy |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/today` | Devuelve el día actual, meta y progreso |
| `POST` | `/api/add` | Suma lagartijas al conteo del día |

Accede a `/docs` para ver la documentación Swagger interactiva.

---

## Despliegue en Dokploy

### 1. Preparar el repositorio

Sube únicamente el contenido de esta carpeta `Backend/` a un repositorio Git (GitHub, GitLab, Bitbucket). Asegúrate de que estén en la raíz:

```
main.py
requirements.txt
Procfile
```

No subas `.env` con credenciales reales.

### 2. Crear la aplicación en Dokploy

1. En Dokploy ve a **Applications → Create Application**.
2. Conecta tu proveedor Git y selecciona el repositorio.
3. En **Build Type** selecciona `Nixpacks`.
4. Dokploy detectará el `Procfile` y usará el comando de arranque automáticamente.

### 3. Configurar variables de entorno

En la pestaña **Environment** agrega:

```env
POSTGRES_HOST=tu-host-db
POSTGRES_PORT=5432
POSTGRES_DB=tu_db
POSTGRES_USER=tu_usuario
POSTGRES_PASSWORD=tu_password
PYTHONUNBUFFERED=1
```

> Si Nixpacks no detecta el `Procfile`, agrega también:
> `NIXPACKS_START_CMD=uvicorn main:app --host 0.0.0.0 --port 8000`

### 4. Configurar dominio

En la pestaña **Domains**:

1. Agrega un dominio o usa el dominio gratuito de Dokploy.
2. En **Container Port** escribe `8000`.
3. Activa HTTPS si usas dominio propio (Let's Encrypt).

Anota la URL pública del backend, la necesitarás para configurar el frontend.

### 5. Desplegar

1. Pulsa **Deploy**.
2. Revisa **Deployments → Logs** hasta confirmar que la app arrancó.
3. Verifica abriendo `https://tu-dominio/docs`.

### 6. Base de datos requerida

La tabla que debe existir en PostgreSQL (esquema `personal`):

```sql
CREATE TABLE IF NOT EXISTS personal."PushUpsChallenge" (
    record_date   DATE PRIMARY KEY,
    day_number    INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0
);
```

### Checklist de errores comunes

| Error | Causa probable |
|---|---|
| `500 password authentication failed` | Credenciales incorrectas en variables de entorno |
| `connection timeout` | Firewall de la BD no permite conexiones desde Dokploy |
| `RuntimeError: No existe registro para la fecha actual` | La tabla existe pero no hay fila para hoy — ejecuta el seeder |
