# Guía de despliegue

Se publican tres piezas en **Render**, todas con plan gratuito y sin tarjeta:

| Pieza | Qué es |
|---|---|
| Base de datos (`musica-db`) | PostgreSQL gratuita de Render |
| API (`musica-api`) | `backend/`: Node + Express. Aplica las migraciones al arrancar |
| Frontend (`musica-web`) | `frontend/`: Vue compilado, con reescritura de rutas |

Todo está descrito en `render.yaml` (en la raíz del repositorio). Se despliega solo cuando el CI de GitHub pasa (`autoDeployTrigger: checksPass`).

> **Importante: la base de datos gratuita de Render caduca 30 días después de crearse** y se borra 14 días más tarde. Como el despliegue es para mostrar el proyecto, crea el Blueprint cerca de la fecha de la presentación. Si necesitas que dure más, usa Neon (ver el anexo al final).

---

## 1. Antes de empezar

- El código que quieres publicar debe estar en la rama **`main`** (flujo `feature/*` → `Develop` → `QA` → `main`) y el CI debe estar en verde.
- Los archivos `.mp3` de `backend/storage/` deben estar **subidos al repositorio**: el servidor los lee de ahí. En el plan gratuito el disco es efímero, así que no se pueden subir canciones desde la app.
- Una cuenta de GitHub y otra de Render (se entra a Render con GitHub).

## 2. Render (10 min)

1. En <https://dashboard.render.com> → **New → Blueprint** → elige este repositorio y la rama `main`.
2. Render lee `render.yaml` y te muestra la base de datos y los dos servicios. Te pide los valores marcados `sync: false`. La primera vez **todavía no conoces las URLs**, así que pon temporalmente:

   | Variable | Servicio | Valor ahora |
   |---|---|---|
   | `FRONTEND_URL` | `musica-api` | `https://pendiente.com` |
   | `VITE_API_BASE_URL` | `musica-web` | `https://pendiente.com` |

3. Pulsa **Apply**. `DATABASE_URL` se conecta sola a `musica-db`, y `JWT_ACCESS_SECRET` y `AUDIO_SECRET_KEY` las genera Render (valores aleatorios de 256 bits). No hay que crear tablas: la API aplica las migraciones al arrancar.
4. Cuando termine el primer despliegue, copia las **dos URLs reales** (aparecen bajo el nombre de cada servicio; si `musica-api` ya existía en Render, le añadió un sufijo).
5. Corrige las variables en **Environment** de cada servicio:
   - `musica-api` → `FRONTEND_URL` = URL del sitio `musica-web`, **sin "/" al final**.
   - `musica-web` → `VITE_API_BASE_URL` = URL de `musica-api`, **sin "/" al final**.
6. Vuelve a desplegar **los dos**. El frontend es obligatorio: Vite escribe `VITE_API_BASE_URL` dentro del código al compilar, así que cambiar la variable sin recompilar no sirve (**Manual Deploy → Clear build cache & deploy**).

## 3. Comprobar que quedó bien

```bash
./scripts/verificar-despliegue.sh https://TU-API.onrender.com https://TU-WEB.onrender.com
```

Revisa que la API conecte con la base de datos, que las rutas de audio y de administración exijan sesión, que CORS permita al frontend y que recargar `/estadisticas` no dé 404. Si estaba dormida, la primera comprobación tarda cerca de un minuto.

Después, a mano: abre el sitio, regístrate, reproduce una canción, recarga la página (la sesión debe mantenerse) y abre **Estadísticas**.

## 4. Crear la cuenta de administrador

Nadie se hace administrador desde la API, a propósito. Regístrate normalmente en el sitio y luego promueve tu cuenta desde tu computador. En Render abre `musica-db` → **Connect → External** y copia el comando `psql` (o la URL externa), y ejecuta:

```sql
UPDATE users SET role = 'admin' WHERE lower(email) = lower('tu-correo@ejemplo.com');
```

o, desde `backend/`, con esa URL externa:

```bash
DATABASE_URL="postgresql://…(URL externa)…" npm run make-admin -- tu-correo@ejemplo.com
```

Cierra sesión y vuelve a entrar: aparece **Administración** en el menú.

---

## Cosas que conviene saber antes de la demo

- **El servidor se duerme** tras 15 minutos sin visitas y tarda cerca de un minuto en despertar. La página ya le avisa al abrirse (`api/warmup.ts`), pero **abre el sitio unos minutos antes de presentar**. Para que no se duerma puedes pedirle a un monitor gratuito (UptimeRobot) que consulte `/health` cada 5 minutos: un único servicio activo todo el mes cabe en las 750 horas gratuitas de Render (los sitios estáticos no cuentan).
- **Las cookies viajan entre dos sitios** (`*.onrender.com` ↔ `*.onrender.com` cuentan como sitios distintos), por eso se usa `COOKIE_SAMESITE=none`. Chrome lo permite; **Safari y algunos navegadores con protección estricta bloquean cookies entre sitios**, y allí la sesión no sobrevive a recargar la página. Si lo necesitas resuelto del todo, se compra un dominio y se sirven `app.midominio.com` y `api.midominio.com`: ahí son el mismo sitio y basta `COOKIE_SAMESITE=lax`.
- **Las canciones viven en el repositorio** y los datos de la base se pierden cuando esta caduca: es una demostración, no un servicio permanente.

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El despliegue de la API falla con `Falta la variable de entorno …` | Una variable no está definida | Revisa `DATABASE_URL`, `JWT_ACCESS_SECRET` y `AUDIO_SECRET_KEY` en **Environment** |
| De repente nada funciona y la base ya no aparece | La base gratuita caducó (30 días) | Crea una nueva (o pasa a Neon) y vuelve a desplegar la API |
| `GET /health` responde 503 | La API no llega a la base | Comprueba que `musica-db` esté en estado *Available* y que API y base estén en la misma región |
| En el navegador: error de CORS | `FRONTEND_URL` no coincide con la URL del sitio | Que sea idéntica, con `https://` y sin "/" final; redespliega la API |
| El frontend llama a `localhost` o a `/api` | `VITE_API_BASE_URL` no estaba al compilar | Corrígela y redespliega el frontend con caché limpia |
| Entras, pero al recargar te pide iniciar sesión otra vez | Cookies entre sitios bloqueadas | Prueba en Chrome o usa un dominio propio (ver arriba) |
| Recargar `/estadisticas` da 404 | Falta la regla de reescritura | Debe existir en `musica-web` → **Redirects/Rewrites**: `/*` → `/index.html` (viene en `render.yaml`) |
| La lista de canciones sale vacía | No hay `.mp3` en `backend/storage` del repositorio | Súbelos a Git y redespliega |
| El despliegue no arranca tras un push | El CI no pasó (`checksPass`) | Arregla el CI; Render despliega solo cuando está en verde |

---

## Anexo: usar Neon en lugar de la base de Render

Solo si necesitas que la base **no caduque**. En <https://neon.com> crea un proyecto y copia la cadena de conexión (debe terminar en `?sslmode=require`). En `render.yaml` borra el bloque `databases:` y cambia `DATABASE_URL` por:

```yaml
      - key: DATABASE_URL
        sync: false
```

Al aplicar el Blueprint, Render te pedirá pegar la cadena de Neon. Para promover al administrador puedes usar el **SQL Editor** de Neon, sin instalar nada. Neon también se suspende al estar inactivo: la primera consulta tarda unos segundos más.
