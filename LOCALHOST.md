# 🖥️ Ejecutar en Localhost

## Inicio Rápido

Para ejecutar el servidor localmente (útil cuando Vercel tiene rate limits):

```bash
npm run local
```

El servidor se iniciará en: **http://localhost:3000**

## Configuración de Spotify para Localhost

Si quieres usar la autenticación de Spotify en localhost, necesitas:

1. **Agregar Redirect URI en Spotify Dashboard:**
   - Ve a https://developer.spotify.com/dashboard
   - Selecciona tu app
   - En "Redirect URIs", agrega: `http://localhost:3000/api/auth/callback`
   - Guarda los cambios

2. **Configurar variable de entorno (opcional):**
   ```bash
   # En tu archivo .env
   SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```

## Comandos Disponibles

- `npm run local` - Inicia el servidor en localhost:3000
- `npm run dev` - Modo desarrollo con watch (reinicia automáticamente)
- `npm run sync-dale-play` - Sincronizar artistas de Dale Play Records
- `npm run manual-sync` - Sincronización manual de artista/track específico

## Notas

- El servidor local usa **HTTP** (no HTTPS) para localhost
- Las variables de entorno se cargan desde `.env`
- El servidor sirve los archivos estáticos desde `/public`
- Todos los endpoints funcionan igual que en Vercel

## Detener el Servidor

Presiona `Ctrl+C` en la terminal donde está corriendo.

