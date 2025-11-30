# 🚀 Guía de Deploy en Vercel

## Opción 1: Deploy con Vercel Cron Jobs (Recomendado)

### Paso 1: Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### Paso 2: Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en "Add New Project"
3. Importa tu repositorio de GitHub
4. Configura el proyecto:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist` (o deja vacío)
   - **Install Command**: `npm install`

### Paso 3: Configurar Variables de Entorno

En Vercel, ve a **Settings > Environment Variables** y agrega:

```
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SUPABASE_URL=tu_url
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SECRET_KEY=tu_secret_key
START_YEAR=2010
LABEL_SEARCH_TERM=dale play records
CRON_SECRET=una_clave_secreta_aleatoria_aqui
```

### Paso 4: Configurar Cron Job

El cron job ya está configurado en `vercel.json` para ejecutarse cada lunes a las 2 AM.

Para cambiar el schedule, edita `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 2 * * 1"  // Cambia esto
    }
  ]
}
```

### Paso 5: Probar el Cron Job

Puedes probar manualmente visitando:
```
https://tu-proyecto.vercel.app/api/cron
```

O ejecutarlo desde Vercel Dashboard > Cron Jobs > Run Now

---

## Opción 2: GitHub Actions (Alternativa)

Si prefieres usar GitHub Actions en lugar de Vercel Cron:

1. Ve a tu repositorio en GitHub
2. **Settings > Secrets and variables > Actions**
3. Agrega todas las variables de entorno como secrets
4. El workflow `.github/workflows/cron.yml` se ejecutará automáticamente

---

## Opción 3: Ejecución Manual desde Vercel

También puedes crear un endpoint para ejecutar manualmente:

```bash
# Ejecutar crawler manualmente
curl -X POST https://tu-proyecto.vercel.app/api/cron \
  -H "Authorization: Bearer tu_cron_secret"
```

---

## Troubleshooting

### El cron no se ejecuta
- Verifica que `vercel.json` tenga la configuración correcta
- Revisa los logs en Vercel Dashboard > Functions
- Asegúrate de que todas las variables de entorno estén configuradas

### Error 401 Unauthorized
- Verifica que `CRON_SECRET` esté configurado en Vercel
- El header `Authorization: Bearer` debe coincidir con `CRON_SECRET`

### Timeout en Vercel
- Vercel tiene un límite de 10 segundos para funciones gratuitas
- Si el crawler tarda más, considera usar GitHub Actions o un servidor dedicado

---

## Notas Importantes

- ⚠️ **CRON_SECRET**: Crea una clave aleatoria segura para proteger tu endpoint
- ⚠️ **Rate Limits**: Vercel tiene límites en el plan gratuito, considera upgrade si necesitas más
- ✅ **Logs**: Revisa los logs en Vercel Dashboard para debugging

