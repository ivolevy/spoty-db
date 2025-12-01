# Roadmap: Flujo Técnico Paso a Paso

## 1️⃣ Buscar Canciones en Spotify

**Proceso interno:**

1. **Obtener artistas de la BD**
   - Consulta Supabase: `SELECT DISTINCT artist_main FROM artist_tracks`
   - Obtiene lista de artistas únicos

2. **Para cada artista:**
   - Busca el artista en Spotify: `GET /v1/search?type=artist&q={nombre}`
   - Obtiene el ID del artista más popular
   - Obtiene top tracks: `GET /v1/artists/{id}/top-tracks?market=AR`
   - Busca más tracks: `GET /v1/search?q=artist:"{nombre}"&type=track&limit=50`

3. **Procesar tracks:**
   - Extrae: nombre, artistas, álbum, fecha, duración, preview_url, cover_url
   - Obtiene géneros del artista
   - Intenta obtener BPM (opcional, puede fallar)

4. **Guardar en Supabase:**
   - Elimina duplicados por `spotify_id` dentro del batch
   - Verifica duplicados existentes en BD
   - Hace `UPSERT` con `onConflict: 'spotify_id'`
   - Solo guarda tracks nuevos

---

## 2️⃣ Verificar Label de Canciones

**Proceso interno:**

1. **Obtener todas las canciones:**
   - Consulta Supabase: `SELECT * FROM artist_tracks`

2. **Para cada canción:**
   - Obtiene info del track: `GET /v1/tracks/{spotify_id}`
   - Extrae `album.id` del track
   - Obtiene info del álbum: `GET /v1/albums/{album_id}`
   - Extrae el `label` del álbum

3. **Normalizar y comparar:**
   - Convierte label a minúsculas
   - Remueve acentos y caracteres especiales
   - Verifica si contiene "dale" y "play"
   - Marca como válida/inválida

4. **Generar reporte:**
   - Canciones válidas (de Dale Play Records)
   - Canciones inválidas (de otros labels)
   - Canciones sin label (no se pudo verificar)

---

## 3️⃣ Eliminar Canciones Inválidas

**Proceso interno:**

1. **Verificar labels** (igual que paso 2)
   - Obtiene todas las canciones
   - Consulta Spotify para cada una
   - Identifica las que NO son de Dale Play Records

2. **Mostrar resumen:**
   - Lista de canciones que se eliminarán
   - Muestra: nombre, artista, álbum, label

3. **Pedir confirmación:**
   - Espera respuesta del usuario (s/n)
   - Si cancela, termina sin eliminar

4. **Eliminar de Supabase:**
   - Para cada canción inválida:
     - `DELETE FROM artist_tracks WHERE spotify_id = '{id}'`
   - Elimina en batches para mejor control
   - Muestra progreso

5. **Confirmar eliminación:**
   - Muestra cuántas canciones se eliminaron
   - Proceso completado

---

## Flujo Completo Visual

```
Spotify API
    ↓
[Buscar tracks por artista]
    ↓
[Extraer metadata]
    ↓
Supabase
    ↓
[Guardar tracks]
    ↓
[Verificar labels desde Spotify]
    ↓
[Identificar inválidas]
    ↓
[Eliminar de Supabase]
    ↓
BD limpia solo con Dale Play Records
```
