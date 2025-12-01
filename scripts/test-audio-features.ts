import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testAudioFeatures() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log('🔍 Probando endpoint de audio-features...\n');

  // Obtener token
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
    }
  );

  const token = tokenResponse.data.access_token;
  console.log('✅ Token obtenido\n');

  // Probar con un track conocido (una canción popular)
  const testTrackId = '4uLU6hMCjMI75M1A2tKUQC'; // Un track de ejemplo de la documentación

  console.log(`🎵 Probando con track ID: ${testTrackId}\n`);

  try {
    // Probar endpoint individual
    console.log('1. Probando endpoint individual /audio-features/{id}...');
    const individualResponse = await axios.get(
      `https://api.spotify.com/v1/audio-features/${testTrackId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    console.log('✅ Endpoint individual funciona!');
    console.log(`   BPM: ${individualResponse.data.tempo}`);
    console.log(`   Duración: ${individualResponse.data.duration_ms}ms\n`);
  } catch (error: any) {
    console.error('❌ Error en endpoint individual:');
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Mensaje: ${JSON.stringify(error.response?.data, null, 2)}\n`);
  }

  try {
    // Probar endpoint batch
    console.log('2. Probando endpoint batch /audio-features?ids=...');
    const batchResponse = await axios.get(
      `https://api.spotify.com/v1/audio-features`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        params: {
          ids: testTrackId,
        },
      }
    );
    console.log('✅ Endpoint batch funciona!');
    console.log(`   Features obtenidas: ${batchResponse.data.audio_features.length}\n`);
  } catch (error: any) {
    console.error('❌ Error en endpoint batch:');
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Mensaje: ${JSON.stringify(error.response?.data, null, 2)}\n`);
  }
}

testAudioFeatures().catch(console.error);

