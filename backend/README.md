# Backend — Música

API REST con Node.js, Express 5, TypeScript y PostgreSQL. Arquitectura **MVC** por capas: **routes → controllers → services → models**. La vista son las respuestas JSON que consume el frontend (Vue).

## Puesta en marcha

1. Crea la base de datos local (una vez): `CREATE DATABASE musica;`
2. Copia `.env.example` a `.env`, pon tu contraseña de PostgreSQL en `DATABASE_URL` y genera el secreto de los tokens:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` → pégalo en `JWT_ACCESS_SECRET`.
3. Instala, migra y arranca:

```sh
npm install
npm run migrate     # aplica las migraciones pendientes de /migrations
npm run dev         # http://localhost:3000/health
```

## Autenticación

Doble token: access token JWT (15 min, se envía en `Authorization: Bearer`) y refresh token opaco y rotativo en una cookie `HttpOnly` limitada a `/auth`.

| Método | Ruta | Respuesta |
|---|---|---|
| POST | `/auth/register` | `201` con `{ accessToken, expiresIn, user }` + cookie. `409 email_taken`, `422 validation_error` |
| POST | `/auth/login` | `200` igual que el registro. `401 invalid_credentials` |
| POST | `/auth/refresh` | `200` con tokens nuevos (el refresh anterior queda inservible). `401 refresh_invalid` |
| POST | `/auth/logout` | `204`; revoca la sesión y limpia la cookie |
| GET | `/auth/me` | Perfil del usuario (requiere access token) |

- Contraseñas con **Argon2id**; en la base solo se guarda el hash.
- Del refresh token solo se guarda su hash SHA-256. Si un token ya usado reaparece fuera de una ventana de 10 s, se revoca toda su cadena (`family_id`).
- Toda cuenta nueva es `listener`; el rol nunca lo decide el cliente.
- `authenticate` y `requireRole('admin')` (en `middlewares/authenticate.ts`) protegen las rutas siguientes.
- Login y registro tienen límite de intentos por IP.

Para probarlo con el frontend, en `frontend/.env.local`:

```
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:3000
```

## Estadísticas de consumo

El frontend registra lo que se escucha (`play`, `progress` cada 15 s, `pause`, `seek`, `complete`) y lo envía en lotes; el backend lo guarda en `playback_events` y lo resume por usuario.

| Método | Ruta | Respuesta |
|---|---|---|
| POST | `/analytics/events` | `202` con `{ accepted }`. Lotes de hasta 100 eventos; se guardan en segundo plano (`BatchQueue`) |
| GET | `/analytics/summary?days=7&tz=America/Bogota` | `200` con `{ totalListenedSec, totalPlays, completionRate, distinctTracks, daily, topTracks }`. `422` si `days` no está entre 1 y 30 o `tz` no es una zona IANA |

- `listenedSec` de cada evento es el tiempo escuchado **desde el evento anterior**; el total es la suma.
- Los días se cortan en la zona horaria `tz` (la del navegador): escuchar a las 9 p. m. en Colombia cuenta como hoy, no como mañana en UTC. Los días sin escucha llegan con `0`.
- El `userId` sale siempre del token: cada persona solo ve su consumo.
- Cada evento guarda la clave de la canción (su nombre de archivo), título y artista, así que el catálogo en archivos no necesita filas en `tracks` (migración `002`).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática |
| `npm run migrate` | Aplica migraciones pendientes (idempotente) |
| `npm run typecheck` | Revisa tipos, incluidos los tests |
| `npm test` | Tests con Vitest y Supertest (usan la base de `DATABASE_URL`) |
| `npm run build` / `npm start` | Compila y ejecuta `dist/` |

## Estructura

```
migrations/      esquema versionado (NNN_nombre.sql, se aplican en orden)
src/
  config/        variables de entorno
  db/            pool de PostgreSQL y ejecutor de migraciones
  routes/        define las URL
  schemas/       validación de entrada con Zod
  types/         tipos compartidos (roles, usuario)
  utils/         logger, contraseñas (Argon2id) y tokens
  controllers/   reciben la petición y responden
  services/      lógica de negocio
  models/        modelos: acceso a datos, consultas SQL siempre parametrizadas (users, refresh tokens, health)
  middlewares/   x-correlation-id, logs, errores
  errors/        AppError (status + code + message)
```

## Convenciones

- Los errores se responden como `{ "code": "...", "message": "..." }`, que es el formato que ya interpreta el frontend.
- Cada petición lleva `x-correlation-id` (el del frontend o uno nuevo) y aparece en los logs.
- Para cambiar el esquema, **no edites una migración ya subida**: crea la siguiente (`002_...sql`).
