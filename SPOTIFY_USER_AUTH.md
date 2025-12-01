# Cómo Autenticar Usuario en Spotify (Authorization Code Flow)

## ¿Por Qué Necesitas Esto?

Con **Client Credentials Flow** (sin usuario):
- ❌ NO puedes acceder a `/audio-features` (BPM)
- ✅ SÍ puedes acceder a tracks, artistas, álbumes básicos

Con **Authorization Code Flow** (con usuario):
- ✅ Puedes acceder a `/audio-features` (BPM)
- ✅ Puedes acceder a más datos de análisis
- ✅ Puedes acceder a datos del usuario

## Cómo Funciona Authorization Code Flow

```
1. Usuario → Click en "Conectar con Spotify"
2. Redirige a Spotify → Usuario autoriza la app
3. Spotify redirige de vuelta → Con código de autorización
4. Tu backend → Intercambia código por access_token + refresh_token
5. Usas el token → Para hacer requests a la API
```

## Implementación Paso a Paso

### Paso 1: Configurar Redirect URI en Spotify Dashboard

1. Ve a https://developer.spotify.com/dashboard
2. Selecciona tu app
3. En "Redirect URIs", agrega:
   - `http://localhost:3000/api/auth/callback` (desarrollo)
   - `https://tu-dominio.vercel.app/api/auth/callback` (producción)
4. Guarda los cambios

### Paso 2: Agregar Variables de Entorno

Agrega a tu `.env`:

```env
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback  # o tu URL de producción
```

### Paso 3: Crear Endpoints de Autenticación

Necesitas crear estos endpoints:

#### 3.1. `/api/auth/login` - Iniciar Login

```typescript
// api/auth/login.ts
import { Request, Response } from 'express';

export async function login(req: Request, res: Response) {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
  
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-read-recently-played',
  ].join(' ');
  
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}`;
  
  res.redirect(authUrl);
}
```

#### 3.2. `/api/auth/callback` - Recibir Código y Obtener Token

```typescript
// api/auth/callback.ts
import { Request, Response } from 'express';
import axios from 'axios';

export async function callback(req: Request, res: Response) {
  const { code } = req.query;
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
  
  try {
    // Intercambiar código por tokens
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    // Guardar tokens (en memoria, Redis, o base de datos)
    // Por ahora, los guardamos en variables de entorno temporales
    // En producción, usa Redis o Supabase para guardar tokens por usuario
    
    // Redirigir a la página principal con éxito
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('Error en callback:', error);
    res.redirect('/?auth=error');
  }
}
```

#### 3.3. Actualizar SpotifyService para Usar Token de Usuario

```typescript
// src/services/spotify.ts
class SpotifyService {
  private userAccessToken: string | null = null;
  
  // Método para establecer token de usuario
  setUserToken(token: string) {
    this.userAccessToken = token;
  }
  
  // Modificar getAccessToken para usar token de usuario si está disponible
  async getAccessToken(): Promise<string> {
    // Si hay token de usuario, usarlo
    if (this.userAccessToken) {
      return this.userAccessToken;
    }
    
    // Si no, usar Client Credentials Flow (fallback)
    // ... código existente ...
  }
  
  // Método para refrescar token de usuario
  async refreshUserToken(refreshToken: string): Promise<string> {
    const clientId = process.env.SPOTIFY_CLIENT_ID!;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
    
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    
    return response.data.access_token;
  }
}
```

### Paso 4: Guardar Tokens en Supabase

Crea una tabla para guardar tokens de usuarios:

```sql
-- Tabla para guardar tokens de usuarios
create table spotify_tokens (
  id bigserial primary key,
  user_id text unique not null,  -- Puede ser un ID de usuario o email
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on spotify_tokens(user_id);
```

### Paso 5: Modificar Sync para Usar Token de Usuario

```typescript
// src/services/sync.ts
export class SyncService {
  async syncArtists(userToken?: string) {
    const spotify = new SpotifyService();
    
    // Si hay token de usuario, usarlo
    if (userToken) {
      spotify.setUserToken(userToken);
    }
    
    // ... resto del código de sincronización ...
  }
}
```

## Flujo Completo

1. **Usuario hace click en "Conectar con Spotify"** → `/api/auth/login`
2. **Spotify redirige a callback** → `/api/auth/callback?code=...`
3. **Backend obtiene tokens** → Guarda en Supabase
4. **Sync usa token de usuario** → Puede obtener BPM
5. **Token expira** → Usa refresh_token para renovar

## Consideraciones Importantes

### 1. Tokens Expiran
- `access_token` expira en ~1 hora
- Usa `refresh_token` para renovar antes de que expire

### 2. Múltiples Usuarios
- Si tienes múltiples usuarios, guarda tokens por usuario
- Usa `user_id` para identificar cada token

### 3. Seguridad
- **NUNCA** expongas `client_secret` en el frontend
- Guarda tokens encriptados en Supabase
- Usa HTTPS siempre

### 4. Para Cron Jobs
- Si el cron necesita ejecutarse sin usuario:
  - Opción A: Usa Client Credentials Flow (sin BPM)
  - Opción B: Guarda un token de usuario "sistema" y úsalo en el cron

## Alternativa Más Simple: Token de Usuario Manual

Si solo necesitas BPM y no quieres implementar el flujo completo:

1. **Obtén un token manualmente**:
   - Ve a: https://developer.spotify.com/console/get-audio-features/
   - Click en "Get Token"
   - Autoriza la app
   - Copia el token

2. **Guárdalo en `.env`**:
   ```env
   SPOTIFY_USER_TOKEN=tu_token_aqui
   ```

3. **Úsalo en el código**:
   ```typescript
   const spotify = new SpotifyService();
   spotify.setUserToken(process.env.SPOTIFY_USER_TOKEN!);
   ```

⚠️ **Nota**: Este token expira en ~1 hora. Necesitarás renovarlo manualmente.

## Próximos Pasos

1. Implementa los endpoints de autenticación
2. Crea la tabla de tokens en Supabase
3. Modifica `SpotifyService` para usar tokens de usuario
4. Actualiza `SyncService` para usar token de usuario cuando esté disponible
5. Agrega botón "Conectar con Spotify" en el frontend

¿Quieres que implemente esto completo en el código?

