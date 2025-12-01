# Cómo Capturar el Token de Spotify

## Método 1: Desde la URL (Más Fácil) ✅

### Paso 1: Conectarte
1. Ve a: `https://spoty-dbtracks.vercel.app`
2. Click en **"Conectar Spotify"**
3. Autoriza la aplicación

### Paso 2: Capturar el Token
Después de autorizar, Spotify te redirige de vuelta a tu app. La URL será algo como:

```
https://spoty-dbtracks.vercel.app/?auth=success&token=BQAbc123def456ghi789jkl012mno345pqr678stu901vwx234yz567&refresh_token=AQBxyz...&expires_in=3600
```

**El token está después de `token=` y antes de `&refresh_token`**

1. **Copia todo el texto después de `token=`**
2. **Detente cuando veas `&refresh_token`** (o el final de la URL)

Ejemplo:
- URL completa: `...token=BQAbc123def456ghi789...&refresh_token=...`
- Token a copiar: `BQAbc123def456ghi789...` (todo hasta el `&`)

### Paso 3: Guardar en .env
Abre tu archivo `.env` y agrega:

```env
SPOTIFY_USER_TOKEN=BQAbc123def456ghi789...tu_token_completo_aqui...
```

**Importante**: 
- No incluyas espacios
- Copia el token completo (es muy largo, ~200 caracteres)
- No incluyas `token=` ni `&refresh_token`

---

## Método 2: Desde la Consola del Navegador

### Paso 1: Conectarte
1. Ve a: `https://spoty-dbtracks.vercel.app`
2. Abre la consola del navegador (F12 o Cmd+Option+I)
3. Ve a la pestaña "Console"
4. Click en **"Conectar Spotify"**
5. Autoriza la aplicación

### Paso 2: Ver el Token en la Consola
Después de autorizar, busca en la consola mensajes como:
- `✅ Conectado con Spotify exitosamente`
- O busca en localStorage

En la consola, escribe:
```javascript
localStorage.getItem('spotify_user_token')
```

Esto te mostrará el token.

### Paso 3: Copiar y Guardar
1. Copia el token que aparece
2. Agrégalo a tu `.env`:
```env
SPOTIFY_USER_TOKEN=tu_token_aqui
```

---

## Método 3: Usar el Script Automático

1. Conéctate desde el frontend (como en Método 1)
2. Copia el token de la URL
3. Ejecuta:
```bash
npm run get-token
```
4. Pega el token cuando te lo pida
5. El script lo guardará automáticamente en `.env`

---

## Verificar que Funcionó

Después de guardar el token, prueba:

```bash
# Verificar que el token está en .env
cat .env | grep SPOTIFY_USER_TOKEN

# Probar sincronización con BPM
npm run manual-sync "Duki"
```

Si ves BPM en los logs, ¡funcionó! ✅

---

## Ejemplo Visual

**URL después de autorizar:**
```
https://spoty-dbtracks.vercel.app/?auth=success&token=BQAbc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ567&refresh_token=AQBxyz...&expires_in=3600
```

**Token a copiar (todo lo que está resaltado):**
```
BQAbc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ567
```

**En .env:**
```env
SPOTIFY_USER_TOKEN=BQAbc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ567
```

---

## Nota Importante

- El token expira en **~1 hora**
- Cuando expire, vuelve a conectarte y captura uno nuevo
- El token es muy largo (más de 200 caracteres), asegúrate de copiarlo completo

