# Cómo Obtener Token de Usuario de Spotify para BPM

## Método 1: Desde el Frontend (MÁS FÁCIL) ✅

1. Ve a tu app: `https://spoty-dbtracks.vercel.app`
2. Click en **"Conectar Spotify"**
3. Autoriza la aplicación
4. El token se guarda automáticamente en el backend
5. Ya puedes sincronizar desde el frontend con BPM

**Ventaja**: Funciona automáticamente, no necesitas copiar nada.

---

## Método 2: Obtener Token Manualmente para Scripts

Si quieres usar el script `npm run manual-sync` desde la consola, necesitas el token:

### Paso 1: Conectarte desde el Frontend

1. Ve a: `https://spoty-dbtracks.vercel.app`
2. Click en **"Conectar Spotify"**
3. Autoriza la aplicación
4. Después de autorizar, mira la URL del navegador

### Paso 2: Extraer el Token de la URL

Después de autorizar, la URL será algo como:
```
https://spoty-dbtracks.vercel.app/?auth=success&token=BQAbc123...&refresh_token=AQBxyz...&expires_in=3600
```

1. Copia el valor después de `token=`
2. Es el string largo que termina antes de `&refresh_token`
3. Agrégalo a tu `.env`:

```env
SPOTIFY_USER_TOKEN=BQAbc123...tu_token_aqui...
```

### Paso 3: Usar el Script

```bash
npm run manual-sync "Duki"
```

---

## Método 3: Usar el Script Interactivo

Ejecuta:
```bash
npm run get-token
```

El script te guiará paso a paso.

---

## Verificar que el Token Funciona

Puedes probar si el token funciona:

```bash
# Verificar credenciales de Spotify
npm run test-spotify

# Probar audio-features (necesita token de usuario)
npm run test-audio
```

---

## Nota Importante

- El token expira en **~1 hora**
- Cuando expire, vuelve a conectarte desde el frontend
- O ejecuta `npm run get-token` de nuevo

---

## ¿Por Qué Necesito Esto?

Para obtener **BPM** (tempo) de las canciones, Spotify requiere autenticación de usuario. Sin el token de usuario:
- ✅ Puedes obtener: nombre, artistas, álbum, duración, preview, cover
- ❌ NO puedes obtener: BPM, danceability, energy, etc.

Con el token de usuario:
- ✅ Puedes obtener TODO, incluyendo BPM

