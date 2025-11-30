# Guía de Configuración Detallada

## 🔑 Obtención de Credenciales

### Spotify API

1. Ve a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Inicia sesión con tu cuenta de Spotify
3. Crea una nueva aplicación
4. Copia el **Client ID** y **Client Secret**
5. Agrega una URL de redirección (puede ser `http://localhost:3000` para desarrollo)

### Supabase

1. Ve a [Supabase](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Ve a **Settings** > **API**
4. Copia la **URL** del proyecto
5. Copia la **service_role key** (⚠️ NUNCA la expongas en el cliente)

## 📝 Configuración del Archivo .env

Crea un archivo `.env` en la raíz del proyecto:

```env
SPOTIFY_CLIENT_ID=tu_client_id_aqui
SPOTIFY_CLIENT_SECRET=tu_client_secret_aqui
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=tu_service_role_key_aqui
START_YEAR=2010
LABEL_SEARCH_TERM=dale play records
```

## 🗄️ Configuración de la Base de Datos

### Opción 1: Usando el SQL Editor de Supabase (Recomendado)

1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Copia y pega el contenido de `supabase-schema.sql`
4. Ejecuta el script

### Opción 2: Usando el script de setup

```bash
npm run setup-db
```

**Nota:** El script puede requerir que ejecutes el SQL manualmente si el RPC no está disponible.

## 🚀 Primera Ejecución

1. **Instala dependencias:**
```bash
npm install
```

2. **Configura la base de datos:**
```bash
npm run setup-db
```

3. **Ejecuta el crawler por primera vez:**
```bash
npm run crawl
```

Esto puede tomar varios minutos dependiendo del tamaño del catálogo.

## ⚙️ Configuración del Cron Job

### Opción 1: Usando node-cron (Desarrollo/Testing)

```bash
npm run dev -- --cron
```

### Opción 2: Usando cron del sistema (Producción)

1. Crea un script ejecutable:
```bash
#!/bin/bash
cd /ruta/al/proyecto
npm run sync
```

2. Agrega al crontab:
```bash
crontab -e
```

3. Agrega esta línea (ejecuta cada lunes a las 2 AM):
```
0 2 * * 1 /ruta/al/script.sh >> /ruta/al/logs/cron.log 2>&1
```

### Opción 3: Usando servicios en la nube

- **Vercel Cron Jobs**: Configura en `vercel.json`
- **GitHub Actions**: Crea un workflow en `.github/workflows/`
- **AWS Lambda + EventBridge**: Para ejecución serverless

## 🔍 Mejora de Búsquedas

El sistema busca tracks de manera amplia y luego filtra por label. Para mejorar los resultados:

1. **Conoce artistas del sello**: Puedes modificar `crawler.ts` para buscar por artistas específicos
2. **Ajusta el rango de años**: Modifica `START_YEAR` en `.env`
3. **Aumenta límites**: Ajusta `maxResultsPerQuery` en `crawler.ts` si es necesario

## 📊 Monitoreo

### Ver logs en tiempo real

```bash
npm run crawl 2>&1 | tee crawler.log
```

### Consultar la base de datos

```sql
-- Ver todos los tracks
SELECT * FROM label_tracks ORDER BY created_at DESC;

-- Contar por género
SELECT genre, COUNT(*) FROM label_tracks GROUP BY genre ORDER BY COUNT(*) DESC;

-- Tracks por año
SELECT EXTRACT(YEAR FROM release_date) as year, COUNT(*) 
FROM label_tracks 
GROUP BY year 
ORDER BY year DESC;

-- Buscar tracks específicos
SELECT * FROM label_tracks WHERE name ILIKE '%termino%';
```

## 🐛 Troubleshooting

### Error: "Invalid client credentials"

- Verifica que `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` sean correctos
- Asegúrate de que no haya espacios extra en el `.env`

### Error: "Rate limit exceeded"

- El sistema maneja esto automáticamente
- Si persiste, aumenta `SPOTIFY_RATE_LIMIT_DELAY` en `.env`
- Reduce la frecuencia de ejecución del cron

### Error: "Table does not exist"

- Ejecuta `npm run setup-db`
- O ejecuta manualmente el SQL en Supabase

### Pocos resultados encontrados

- Spotify API no permite búsqueda directa por label
- El sistema busca de manera amplia y filtra después
- Considera agregar búsquedas por artistas conocidos del sello

## 🔐 Seguridad

- ⚠️ **NUNCA** commits el archivo `.env` al repositorio
- ⚠️ **NUNCA** uses la `service_role key` en código del cliente
- ✅ Usa variables de entorno en producción
- ✅ Rota las credenciales periódicamente

