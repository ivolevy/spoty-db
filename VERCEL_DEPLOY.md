# Deploy en Vercel

## Pasos para hacer deploy

1. **Conectar repositorio en Vercel:**
   - Ve a [vercel.com](https://vercel.com)
   - Importa el repositorio de GitHub
   - Vercel detectará automáticamente el proyecto

2. **Configurar variables de entorno:**
   En el dashboard de Vercel, agrega estas variables:
   ```
   SPOTIFY_CLIENT_ID=tu_client_id
   SPOTIFY_CLIENT_SECRET=tu_client_secret
   SUPABASE_URL=tu_supabase_url
   SUPABASE_ANON_KEY=tu_anon_key
   SUPABASE_SECRET_KEY=tu_secret_key
   PORT=3000
   CRON_SECRET=tu_secret_aleatorio (opcional, para proteger el cron)
   ```

3. **Configuración del proyecto:**
   - **Framework Preset:** Other
   - **Build Command:** (dejar vacío o `npm run build`)
   - **Output Directory:** (dejar vacío)
   - **Install Command:** `npm install`

4. **Cron Job:**
   - El cron está configurado en `vercel.json` para ejecutarse cada domingo a las 00:00 UTC
   - Puedes cambiarlo modificando el schedule en `vercel.json`
   - El endpoint `/api/cron` ejecutará la sincronización

5. **Deploy:**
   - Haz clic en "Deploy"
   - Vercel construirá y desplegará automáticamente

## Endpoints disponibles después del deploy

- `GET /health` - Health check
- `GET /tracks` - Todos los tracks
- `GET /tracks/:id` - Track por ID
- `GET /artists` - Lista de artistas
- `GET /artists/:name/tracks` - Tracks de un artista
- `GET /metrics/global` - Métricas globales
- `GET /metrics/artist/:name` - Métricas de un artista
- `GET /api/cron` - Ejecutar sincronización manualmente (protegido con CRON_SECRET si está configurado)

## Notas importantes

- El cron job se ejecutará automáticamente cada semana
- Puedes ejecutar la sincronización manualmente llamando a `/api/cron`
- Los logs se pueden ver en el dashboard de Vercel
- Si necesitas cambiar el schedule del cron, edita `vercel.json` y haz push

