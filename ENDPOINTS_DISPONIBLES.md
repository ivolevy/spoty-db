# Endpoints de Spotify Disponibles vs No Disponibles

## ❌ Por Qué NO Puedes Acceder a `/audio-features`

El endpoint `/audio-features` devuelve **403 Forbidden** porque:

1. **Client Credentials Flow tiene limitaciones**: Este tipo de autenticación (sin usuario) tiene acceso restringido a ciertos endpoints
2. **Audio Features puede requerir autenticación de usuario**: Algunos endpoints de análisis de audio requieren que un usuario real inicie sesión
3. **Restricciones de la API**: Spotify puede haber cambiado los requisitos de acceso para este endpoint específico

**No es un problema de tu código**, es una limitación del tipo de autenticación que estás usando.

## ✅ Endpoints a los que SÍ Puedes Acceder

Con **Client Credentials Flow**, puedes acceder a estos endpoints:

### 1. `/v1/search` ✅
- Buscar artistas, tracks, álbumes
- **Lo usamos para**: Buscar IDs de artistas
- **Ejemplo**: `GET /v1/search?type=artist&q=Duki`

### 2. `/v1/artists/{id}` ✅
- Información completa del artista
- **Lo usamos para**: Obtener géneros del artista
- **Datos disponibles**:
  - `genres[]` - Géneros
  - `popularity` - Popularidad
  - `name` - Nombre
  - `id` - ID

### 3. `/v1/artists/{id}/top-tracks` ✅
- Top tracks de un artista
- **Lo usamos para**: Obtener los 5 tracks más populares
- **Datos disponibles**:
  - `id` - ID del track
  - `name` - Nombre de la canción
  - `artists[]` - Array de artistas (nombre e ID)
  - `album.name` - Nombre del álbum
  - `album.release_date` - Fecha de lanzamiento
  - `album.images[]` - URLs de portadas
  - `duration_ms` - Duración en milisegundos
  - `preview_url` - URL de preview (30 segundos, si está disponible)

### 4. `/v1/tracks/{id}` ✅ (no lo usamos actualmente)
- Información detallada de un track específico
- Similar a top-tracks pero para un track individual

## ❌ Endpoints a los que NO Puedes Acceder

### 1. `/v1/audio-features` ❌
- **Error**: 403 Forbidden
- **Razón**: Requiere permisos especiales o autenticación de usuario
- **Datos que no puedes obtener**:
  - `tempo` (BPM)
  - `danceability`
  - `energy`
  - `valence`
  - etc.

### 2. `/v1/audio-analysis/{id}` ❌
- Análisis detallado de audio
- Requiere autenticación de usuario

### 3. Endpoints de usuario ❌
- `/v1/me` - Información del usuario
- `/v1/me/playlists` - Playlists del usuario
- Requieren autenticación de usuario (Authorization Code Flow)

## 📊 Resumen de Datos que SÍ Estás Obteniendo

Por cada track que guardas en Supabase:

```typescript
{
  spotify_id: "4aDbrgm1ZaebS1Bb2dOXac",      // ✅
  name: "Niño",                               // ✅
  artists: ["Milo j"],                        // ✅
  artist_main: "Duki",                        // ✅
  album: "111",                               // ✅
  release_date: "2023-01-01",                 // ✅
  duration_ms: 180000,                        // ✅
  bpm: null,                                  // ❌ (no disponible)
  genres: ["reggaeton", "trap"],              // ✅
  preview_url: "https://...",                 // ✅ (si está disponible)
  cover_url: "https://...",                   // ✅
  fetched_at: "2025-12-01T..."                // ✅
}
```

## 🔍 Cómo Verificar Qué Endpoints Funcionan

Puedes probar endpoints manualmente con:

```bash
# Obtener token
TOKEN=$(curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'TU_CLIENT_ID:TU_CLIENT_SECRET' | base64)" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Probar endpoint
curl "https://api.spotify.com/v1/artists/1wKDGglKV4FsFS85r2Dmpr/top-tracks?market=US" \
  -H "Authorization: Bearer $TOKEN"
```

## 💡 Conclusión

**SÍ puedes obtener**:
- ✅ Nombre, artistas, álbum
- ✅ Fecha de lanzamiento
- ✅ Duración
- ✅ Preview URL (cuando está disponible)
- ✅ Cover URL
- ✅ Géneros del artista

**NO puedes obtener**:
- ❌ BPM (tempo)
- ❌ Otras características de audio

El código está funcionando correctamente con los datos disponibles. El problema del BPM es una limitación de la API de Spotify con Client Credentials Flow.

