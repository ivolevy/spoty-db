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

SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SECRET_KEY=tu_secret_key

PORT=3000
```

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

