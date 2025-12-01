# Permisos y Datos Disponibles de Spotify API

## Datos que Actualmente Estamos Obteniendo ✅

Con **Client Credentials Flow** (sin autenticación de usuario), puedes acceder a:

### 1. Información del Track (desde `/v1/artists/{id}/top-tracks`)
- ✅ `id` - ID único de Spotify
- ✅ `name` - Nombre de la canción
- ✅ `artists[]` - Array de artistas (nombre e ID)
- ✅ `album.name` - Nombre del álbum
- ✅ `album.release_date` - Fecha de lanzamiento
- ✅ `album.images[]` - URLs de portadas (cover_url)
- ✅ `duration_ms` - Duración en milisegundos
- ✅ `preview_url` - URL de preview de 30 segundos (si está disponible)

### 2. Información del Artista (desde `/v1/artists/{id}`)
- ✅ `genres[]` - Géneros del artista
- ✅ `popularity` - Popularidad del artista

### 3. Datos que NO podemos obtener actualmente ❌
- ❌ `bpm` (tempo) - Requiere `/audio-features` que da 403 Forbidden
- ❌ `audio-analysis` - Requiere permisos especiales
- ❌ Información de usuario (playlists, follows, etc.) - Requiere autenticación de usuario

## Cómo Verificar Permisos en Spotify Dashboard

### Paso 1: Acceder al Dashboard
1. Ve a: https://developer.spotify.com/dashboard
2. Inicia sesión con tu cuenta de Spotify
3. Selecciona tu app

### Paso 2: Verificar Configuración de la App
En la página de tu app, verifica:

1. **App Name**: Nombre de tu app
2. **Client ID**: Tu Client ID (debe coincidir con `.env`)
3. **Client Secret**: Click en "View client secret" (debe coincidir con `.env`)
4. **Redirect URIs**: Para Client Credentials Flow no es necesario, pero puedes agregar:
   - `http://localhost:3000/callback` (para desarrollo)
   - `https://tu-dominio.vercel.app/callback` (para producción)

### Paso 3: Verificar Permisos/Scopes
**IMPORTANTE**: Client Credentials Flow tiene limitaciones:

- ✅ **No requiere scopes** para la mayoría de endpoints públicos
- ❌ **Audio Features** puede requerir permisos especiales o no estar disponible con Client Credentials

### Paso 4: Verificar Estado de la App
- La app debe estar **activa** (no suspendida)
- No debe tener restricciones de uso

## Por Qué Audio-Features Da 403

El endpoint `/audio-features` puede estar restringido porque:

1. **Tu app está en modo Desarrollo** - Las apps en desarrollo tienen restricciones y cuotas limitadas
2. **Requiere extensión de cuota** - Puede necesitar solicitar acceso extendido en el Dashboard
3. **Cambios en la API de Spotify** - Spotify puede haber cambiado los requisitos de acceso
4. **Restricciones geográficas** - Algunos endpoints pueden estar bloqueados por región

### Cómo Solucionarlo

#### Opción 1: Verificar Modo de la App
1. Ve a https://developer.spotify.com/dashboard
2. Selecciona tu app
3. Busca la sección "App Status" o "Quota"
4. Si está en "Development Mode", puedes:
   - Solicitar extensión de cuota
   - O cambiar a "Production Mode" (si cumples requisitos)

#### Opción 2: Solicitar Extensión de Cuota
1. En el Dashboard, busca "Quota Extension" o "Request Extension"
2. Explica tu caso de uso (obtener BPM de tracks)
3. Spotify puede aprobar acceso extendido

#### Opción 3: Verificar Documentación Actualizada
- Revisa: https://developer.spotify.com/documentation/web-api/reference/get-audio-features
- Verifica si hay cambios recientes en los requisitos

## Soluciones Posibles

### Opción 1: Usar Authorization Code Flow (con usuario)
- Requiere que un usuario inicie sesión
- Permite acceso a más endpoints
- Más complejo de implementar

### Opción 2: Continuar sin BPM
- Las tracks se guardan correctamente
- Solo falta el BPM
- Preview URL funciona cuando está disponible

### Opción 3: Contactar Soporte de Spotify
- Puedes contactar a Spotify para solicitar acceso a audio-features
- Explicar tu caso de uso

## Datos Actuales que se Guardan en Supabase

```sql
- spotify_id (text)
- name (text)
- artists (text[])
- artist_main (text)
- album (text)
- release_date (date)
- duration_ms (int)
- bpm (numeric) ← NULL actualmente por 403
- genres (text[])
- preview_url (text) ← Se guarda cuando está disponible
- cover_url (text)
- fetched_at (timestamptz)
```

## Test de Endpoints Disponibles

Puedes probar qué endpoints funcionan ejecutando:

```bash
npm run test-spotify  # Test de credenciales
npm run test-audio    # Test de audio-features (actualmente falla)
```

