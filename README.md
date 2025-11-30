# Spotify Label Tracker - Dale Play Records

Sistema autónomo para rastrear, extraer y almacenar todas las canciones del sello discográfico "Dale Play Records" desde la API de Spotify.

## 🎯 Características

- ✅ Búsqueda inteligente de canciones por label con reconocimiento de variantes
- ✅ Conexión OAuth con Spotify API
- ✅ Extracción completa de metadata (BPM, género, preview, portada, etc.)
- ✅ Almacenamiento en Supabase con deduplicación automática
- ✅ Manejo automático de rate limits con reintentos
- ✅ Cron job semanal para mantener la base actualizada
- ✅ Búsqueda por años (2010 - actualidad)

## 📋 Requisitos Previos

1. **Node.js** (v18 o superior)
2. **Cuenta de Spotify** con aplicación registrada en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
3. **Cuenta de Supabase** con proyecto creado

## 🚀 Instalación

1. **Clonar/descargar el proyecto**

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**

Crea un archivo `.env` en la raíz del proyecto con:

```env
# Spotify API Credentials
SPOTIFY_CLIENT_ID=tu_client_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_de_spotify

# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_service_role_key_de_supabase

# Crawler Configuration (opcional)
START_YEAR=2010
LABEL_SEARCH_TERM=dale play records

# Rate Limiting (opcional)
SPOTIFY_RATE_LIMIT_RETRIES=5
SPOTIFY_RATE_LIMIT_DELAY=1000
```

## 🗄️ Configuración de Base de Datos

1. Ve al SQL Editor en tu proyecto de Supabase
2. Ejecuta el script `supabase-schema.sql` o copia y pega:

```sql
CREATE TABLE IF NOT EXISTS label_tracks (
  id bigint generated always as identity primary key,
  spotify_id text unique,
  name text,
  artists text[],
  album text,
  label text,
  label_normalized text,
  release_date date,
  duration_ms int,
  genre text,
  bpm numeric,
  preview_url text,
  cover_url text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_label_tracks_label_normalized ON label_tracks(label_normalized);
CREATE INDEX IF NOT EXISTS idx_label_tracks_spotify_id ON label_tracks(spotify_id);
CREATE INDEX IF NOT EXISTS idx_label_tracks_genre ON label_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_label_tracks_release_date ON label_tracks(release_date);
```

## 📖 Uso

### Ejecución única (crawler completo)

```bash
npm run crawl
# o
npm run dev -- --crawl
```

### Sincronización semanal manual

```bash
npm run sync
```

### Cron job (ejecución automática semanal)

```bash
npm run dev -- --cron
```

El cron job se ejecuta cada lunes a las 2:00 AM por defecto. Puedes cambiar el schedule:

```bash
npm run dev -- --cron --schedule "0 3 * * 1"
```

**Formatos de schedule (cron):**
- `0 2 * * 1` - Cada lunes a las 2:00 AM
- `0 */6 * * *` - Cada 6 horas
- `0 0 * * 0` - Cada domingo a medianoche

### Setup de base de datos

```bash
npm run setup-db
```

## 🔍 Funcionalidades Detalladas

### Búsqueda Inteligente de Labels

El sistema reconoce todas las variantes posibles del nombre del sello:

- "Dale Play Records"
- "DALE PLAY RECORDS"
- "Dale play records"
- "DalePlay Records"
- "Dale Play Records / Sony Music"
- "Dale Play Records (Under exclusive license...)"

### Extracción de Datos

Cada track incluye:

- **spotify_id**: ID único de Spotify
- **name**: Nombre del track
- **artists**: Lista de artistas
- **album**: Álbum de origen
- **label**: Label original
- **label_normalized**: Label normalizado para búsquedas
- **release_date**: Fecha de lanzamiento
- **duration_ms**: Duración en milisegundos
- **genre**: Género (del artista si el track no tiene)
- **bpm**: Tempo obtenido de audio-features
- **preview_url**: URL del preview de 30 segundos
- **cover_url**: Portada del álbum
- **created_at**: Timestamp de creación

### Deduplicación

- El sistema evita duplicados usando `spotify_id` como clave única
- Los tracks existentes se actualizan si hay cambios en BPM o género
- La deduplicación se realiza antes de insertar en la base de datos

### Manejo de Rate Limits

- Reintentos automáticos cuando Spotify devuelve HTTP 429
- Respeta el header `Retry-After` de Spotify
- Pausas inteligentes entre requests para evitar límites

## 📁 Estructura del Proyecto

```
bdd/
├── src/
│   ├── config.ts              # Configuración y variables de entorno
│   ├── types.ts               # Tipos TypeScript
│   ├── spotify-client.ts      # Cliente de Spotify API
│   ├── supabase-client.ts     # Cliente de Supabase
│   ├── label-matcher.ts       # Lógica de matching de labels
│   ├── track-processor.ts     # Procesamiento de tracks
│   ├── crawler.ts             # Crawler principal
│   ├── sync.ts                # Sincronización semanal
│   ├── cron-job.ts            # Gestor de cron jobs
│   ├── setup-database.ts      # Setup de base de datos
│   └── index.ts               # Punto de entrada
├── supabase-schema.sql        # Script SQL para crear tabla
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Desarrollo

### Compilar TypeScript

```bash
npm run build
```

### Ejecutar en modo desarrollo

```bash
npm run dev
```

## 📊 Logs y Monitoreo

El sistema genera logs detallados:

- ✅ Tracks encontrados y procesados
- ⚠️ Advertencias de rate limits
- ❌ Errores con detalles
- 📊 Estadísticas finales

## 🔐 Seguridad

- Las credenciales se almacenan en variables de entorno
- El archivo `.env` está en `.gitignore`
- Usa Service Role Key de Supabase solo en servidor (nunca en cliente)

## 🐛 Troubleshooting

### Error: "SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET son requeridos"

Verifica que el archivo `.env` existe y tiene las credenciales correctas.

### Error: Rate limit excedido

El sistema maneja esto automáticamente, pero si persiste, aumenta `SPOTIFY_RATE_LIMIT_DELAY` en `.env`.

### Error: Tabla no existe

Ejecuta `npm run setup-db` o ejecuta manualmente el SQL en Supabase.

## 📝 Notas

- El sistema busca tracks desde 2010 hasta la fecha actual
- La búsqueda puede tomar varios minutos dependiendo del catálogo
- Los géneros se obtienen del artista si el track no tiene género propio
- El BPM se obtiene del endpoint `audio-features` de Spotify

## 📄 Licencia

MIT

