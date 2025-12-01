# Explicación de la Búsqueda y Parámetros

## Cómo Funciona la Búsqueda

### 1. Búsqueda de Artistas

**Endpoint usado**: `GET /v1/search?type=artist&q=<nombre>`

**Cómo funciona**:
- Busca artistas por nombre exacto o similar
- Retorna hasta 10 resultados
- Los ordena por popularidad (más popular primero)
- El script busca coincidencia exacta primero, si no encuentra usa el más popular

**Ejemplo**:
```
Buscar "Duki" → Encuentra "Duki" (coincidencia exacta)
Buscar "Milo" → Encuentra "Milo j" (más popular)
```

**Limitaciones**:
- Solo busca por nombre, no por label
- Puede encontrar artistas con el mismo nombre pero de otros sellos
- Depende de cómo esté escrito el nombre en Spotify

---

### 2. Obtención de Canciones

**Endpoint usado**: `GET /v1/artists/{id}/top-tracks?market=US`

**Cómo funciona**:
- Obtiene los **top tracks** del artista (los más populares)
- Spotify retorna hasta **10 tracks** por artista
- Los tracks están ordenados por popularidad
- El script puede tomar menos (ej: solo 5) o todos (10)

**Parámetros**:
- `market=US`: Mercado (puede afectar qué tracks están disponibles)
- `limit`: No aplica aquí, siempre retorna hasta 10

**Limitaciones**:
- Solo obtiene los **top 10 tracks** más populares
- No puede obtener TODAS las canciones del artista
- No filtra por label (Dale Play Records)
- Los tracks pueden ser de diferentes álbumes/EPs

---

### 3. Parámetros del Script

#### `--tracks-per-artist` (cantidad de canciones)

**Por defecto**: 10 canciones por artista

**Opciones**:
```bash
# 5 canciones (más rápido)
npm run sync-dale-play -- --tracks-per-artist 5

# 10 canciones (por defecto)
npm run sync-dale-play -- --tracks-per-artist 10

# Máximo disponible (10, porque Spotify solo da 10)
npm run sync-dale-play -- --tracks-per-artist 10
```

**Nota**: Spotify solo retorna máximo 10 tracks por artista, así que pedir más de 10 no tiene efecto.

---

#### `--artists` (artistas específicos)

**Por defecto**: Todos los 14 artistas de Dale Play Records

**Formato**: Lista separada por comas

**Ejemplos**:
```bash
# Solo algunos artistas
npm run sync-dale-play -- --artists "Duki,Bizarrap,Airbag"

# Un solo artista
npm run sync-dale-play -- --artists "Duki"

# Varios artistas con más canciones
npm run sync-dale-play -- --artists "Duki,Bizarrap" --tracks-per-artist 10
```

**Artistas disponibles por defecto**:
1. Duki
2. Bizarrap
3. Nicki Nicole
4. Paulo Londra
5. Rels B
6. Airbag
7. Lali
8. Milo j
9. Rei Delaossa
10. LUANA
11. Taichu
12. Urbanse
13. Lautaro LR
14. Emilia

---

#### `--with-bpm` (obtener BPM)

**Por defecto**: BPM deshabilitado (porque da 403)

**Uso**:
```bash
# Intentar obtener BPM (probablemente fallará con 403)
npm run sync-dale-play -- --with-bpm
```

**Nota**: Actualmente da 403 Forbidden, así que por defecto está deshabilitado.

---

## Ejemplos de Uso Completos

### Ejemplo 1: Todos los artistas, 10 canciones cada uno
```bash
npm run sync-dale-play
```
**Resultado**: ~140 tracks (14 artistas × 10 canciones)

---

### Ejemplo 2: Solo algunos artistas, 5 canciones cada uno
```bash
npm run sync-dale-play -- --artists "Duki,Bizarrap,Airbag,Emilia" --tracks-per-artist 5
```
**Resultado**: 20 tracks (4 artistas × 5 canciones)

---

### Ejemplo 3: Un solo artista con todas sus canciones disponibles
```bash
npm run sync-dale-play -- --artists "Duki" --tracks-per-artist 10
```
**Resultado**: 10 tracks de Duki (máximo disponible)

---

## Limitaciones Actuales

### ❌ No puede obtener TODAS las canciones
- Spotify solo permite obtener los **top 10 tracks** por artista
- No hay endpoint para obtener todas las canciones de un artista
- No se puede filtrar por label directamente

### ❌ No filtra por label automáticamente
- El script busca por nombre de artista
- No verifica si el artista está en Dale Play Records
- Puede incluir tracks de otros sellos si el artista cambió de sello

### ❌ BPM no funciona (403 Forbidden)
- El endpoint `/audio-features` requiere permisos especiales
- Spotify bloquea el acceso para apps en desarrollo
- Por ahora se guarda sin BPM

---

## Qué Datos SÍ se Obtienen

Para cada canción se guarda:
- ✅ `spotify_id`: ID único de Spotify
- ✅ `name`: Nombre de la canción
- ✅ `artists`: Lista de artistas (puede haber colaboraciones)
- ✅ `artist_main`: Artista principal (el que buscaste)
- ✅ `album`: Nombre del álbum/EP
- ✅ `release_date`: Fecha de lanzamiento
- ✅ `duration_ms`: Duración en milisegundos
- ✅ `preview_url`: Preview de 30 segundos (si está disponible)
- ✅ `cover_url`: Portada del álbum
- ✅ `genres`: Géneros del artista
- ❌ `bpm`: NULL (por el 403)

---

## Cálculo de Tracks Totales

**Fórmula**:
```
Total tracks = Número de artistas × Canciones por artista
```

**Ejemplos**:
- 14 artistas × 10 canciones = **140 tracks**
- 4 artistas × 5 canciones = **20 tracks**
- 1 artista × 10 canciones = **10 tracks**

---

## Tiempo Estimado

**Por artista**: ~2-5 segundos
- Buscar artista: ~0.5s
- Obtener info: ~0.5s
- Obtener tracks: ~1s
- Guardar en Supabase: ~1-2s

**Total**:
- 14 artistas: ~1-2 minutos
- 4 artistas: ~20-30 segundos

---

## Recomendaciones

1. **Para empezar rápido**: Usa pocos artistas primero
   ```bash
   npm run sync-dale-play -- --artists "Duki,Bizarrap" --tracks-per-artist 5
   ```

2. **Para obtener más datos**: Usa todos los artistas con 10 canciones
   ```bash
   npm run sync-dale-play
   ```

3. **Si falla algún artista**: El script continúa con los demás y muestra un resumen al final

