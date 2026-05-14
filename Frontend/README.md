# Push-ups Challenge — Frontend

Interfaz web estática (HTML + CSS + JS) para el reto de lagartijas. Estilo **retro arcade** (CRT, scanlines, neón) y diseño responsivo: funciona igual de bien en escritorio que en el teléfono. Se conecta a la API del Backend para sincronizar el progreso diario.

## Contenido de la carpeta

| Archivo | Descripción |
|---|---|
| `index.html` | Estructura HTML: HUD del cabinete arcade, anillo de progreso, botones y formulario |
| `styles.css` | Estilos retro: scanlines, neón, tipografías `Press Start 2P` / `VT323`, media queries para móvil |
| `app.js` | Lógica de la aplicación: comunicación con la API, actualización optimista de la UI |
| `Dockerfile` | Imagen Docker con Nginx para servir los archivos estáticos en Dokploy |

## Responsive

El layout se adapta automáticamente con media queries en `styles.css`:

- `<= 600px` — padding y bordes reducidos, anillo de progreso 170 px, botones más compactos.
- `<= 360px` — ajustes extra para pantallas pequeñas tipo iPhone SE.
- Orientación apaisada con poca altura — el contenido se compacta verticalmente.
- `@media (hover: none)` — desactiva el efecto de levantamiento de botones en pantallas táctiles.
- Se respeta `prefers-reduced-motion` y los `safe-area-inset` del notch en iOS.

## Cómo funciona

Al cargar la página, `app.js` llama a `GET /api/today` para obtener el día actual, la meta y el progreso. Al pulsar un botón, actualiza la UI inmediatamente (optimistic update) y luego llama a `POST /api/add`. Si la llamada falla, revierte al valor anterior.

## Configurar la URL de la API

Abre [app.js](app.js) y edita la primera línea:

```js
const API_BASE_URL = ""; // Ejemplo: "https://api.midominio.com"
```

También puedes pasar la URL por query parameter sin tocar el código:

```
https://tu-frontend.com/?api=https://api.midominio.com
```

El query param tiene prioridad sobre la constante definida en el archivo.

---

## Despliegue en Dokploy

El frontend es un sitio estático servido por **Nginx** dentro de un contenedor Docker.

### 1. Preparar el repositorio

Sube el contenido de esta carpeta `Frontend/` a un repositorio Git. Asegúrate de que estén en la raíz:

```
index.html
styles.css
app.js
Dockerfile
```

### 2. Configurar la URL de la API

Antes de subir, edita `app.js` y escribe la URL pública del backend:

```js
const API_BASE_URL = "https://api.tu-dominio.com";
```

Guarda el cambio y haz commit.

### 3. Crear la aplicación en Dokploy

1. En Dokploy ve a **Applications → Create Application**.
2. Conecta tu proveedor Git y selecciona el repositorio del frontend.
3. En **Build Type** selecciona `Dockerfile`.
4. Dokploy construirá la imagen con Nginx automáticamente.

### 4. Configurar dominio

En la pestaña **Domains**:

1. Agrega un dominio o usa el dominio gratuito de Dokploy.
2. En **Container Port** escribe `80` (puerto por defecto de Nginx).
3. Activa HTTPS si usas dominio propio (Let's Encrypt).

### 5. Desplegar

1. Pulsa **Deploy**.
2. Revisa **Deployments → Logs** hasta confirmar que el contenedor arrancó.
3. Abre el dominio en el navegador y verifica que la UI carga y se conecta al backend.

### Checklist de errores comunes

| Error | Causa probable |
|---|---|
| La UI carga pero muestra `0 / -- LAGARTIJAS` | `API_BASE_URL` no está configurado o la URL es incorrecta |
| Error CORS en la consola del navegador | El backend tiene `allow_origins` restringido — verifica que incluya el dominio del frontend |
| Página en blanco | `styles.css` o `app.js` no se encuentran — asegúrate de que los tres archivos están en la misma carpeta |
