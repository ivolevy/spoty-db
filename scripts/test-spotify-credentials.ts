import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log('🔍 Verificando credenciales de Spotify...\n');

  if (!clientId || !clientSecret) {
    console.error('❌ Error: SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET deben estar en el archivo .env');
    process.exit(1);
  }

  console.log(`✅ Client ID encontrado: ${clientId.substring(0, 10)}...`);
  console.log(`✅ Client Secret encontrado: ${clientSecret.substring(0, 10)}...\n`);

  try {
    console.log('🌐 Intentando obtener token de Spotify...\n');

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${authString}`,
        },
        timeout: 10000,
      }
    );

    if (response.data.access_token) {
      console.log('✅ ¡ÉXITO! Las credenciales son correctas.\n');
      console.log(`Token obtenido: ${response.data.access_token.substring(0, 20)}...`);
      console.log(`Expira en: ${response.data.expires_in} segundos`);
      process.exit(0);
    } else {
      console.error('❌ Error: No se recibió token de acceso');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error obteniendo token:\n');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Mensaje: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.error('\n⚠️  Las credenciales son incorrectas o inválidas.');
        console.error('   Verifica que el Client ID y Client Secret sean correctos en Spotify Dashboard.');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('⏱️  Timeout: La conexión tardó demasiado.');
      console.error('   Puede ser un problema de red.');
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

testSpotifyCredentials();

