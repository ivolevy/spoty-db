# Spotify Artists Sync Backend

Backend service para sincronizar los top 5 tracks de artistas específicos desde Spotify a Supabase.

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y completa las variables:

```env
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback  # Para autenticación de usuario
SPOTIFY_USER_TOKEN=opcional_token_de_usuario  # Para obtener BPM (ver SPOTIFY_USER_AUTH.md)

SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SECRET_KEY=tu_secret_key

PORT=3000
```

### Autenticación de Usuario (Opcional - Para obtener BPM)

Para obtener BPM y otras características de audio, necesitas autenticar un usuario. Ver `SPOTIFY_USER_AUTH.md` para instrucciones completas.

**Método rápido (temporal)**:
1. Ve a https://developer.spotify.com/console/get-audio-features/
2. Click en "Get Token" y autoriza
3. Copia el token y agrégalo a `.env` como `SPOTIFY_USER_TOKEN=tu_token`
4. El token expira en ~1 hora, necesitarás renovarlo manualmente

## Setup de Base de Datos

Ejecuta el schema SQL en Supabase:

```bash
npm run setup-db
```

O ejecuta manualmente el contenido de `supabase-schema.sql` en el SQL Editor de Supabase.

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Ejecutar Sincronización Manual

```bash
npm run sync
```

## Endpoints API

- `GET /health` - Health check
- `GET /tracks` - Obtener todos los tracks
- `GET /tracks/:id` - Obtener track por ID
- `GET /artists` - Obtener lista de artistas
- `GET /artists/:name/tracks` - Obtener tracks de un artista
- `GET /metrics/global` - Métricas globales
- `GET /metrics/artist/:name` - Métricas de un artista

## Cron Job

El script `scripts/cron-sync.ts` puede ser ejecutado semanalmente usando un cron job o servicio como Vercel Cron.

