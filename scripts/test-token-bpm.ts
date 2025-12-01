import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * Script para probar si el token puede acceder a audio-features
 */

async function testTokenBPM() {
  const token = process.env.SPOTIFY_USER_TOKEN;

  if (!token) {
    console.error('❌ SPOTIFY_USER_TOKEN no está en .env');
    process.exit(1);
  }

  console.log('🔍 Probando token de usuario...');
  console.log(`Token (primeros 20 chars): ${token.substring(0, 20)}...`);

  // 1. Probar acceso básico
  try {
    console.log('\n1️⃣ Probando acceso básico (/me)...');
    const meResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log(`✅ Token válido! Usuario: ${meResponse.data.display_name || meResponse.data.id}`);
  } catch (error: any) {
    console.error(`❌ Error en /me: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    if (error.response?.status === 401) {
      console.error('   El token expiró o es inválido');
      process.exit(1);
    }
  }

  // 2. Probar audio-features con un track conocido
  const testTrackId = '4iV5W9uYEdYUVa79Axb7Rh'; // Track conocido de Spotify
  try {
    console.log(`\n2️⃣ Probando audio-features con track ${testTrackId}...`);
    const audioResponse = await axios.get(`https://api.spotify.com/v1/audio-features/${testTrackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (audioResponse.data.tempo) {
      console.log(`✅ Audio-features FUNCIONA!`);
      console.log(`   BPM: ${Math.round(audioResponse.data.tempo)}`);
      console.log(`   Danceability: ${audioResponse.data.danceability}`);
      console.log(`   Energy: ${audioResponse.data.energy}`);
    }
  } catch (error: any) {
    console.error(`❌ Error en audio-features: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    if (error.response?.status === 403) {
      console.error('\n⚠️  403 Forbidden - Posibles causas:');
      console.error('   1. El token no tiene los scopes necesarios');
      console.error('   2. La app de Spotify está en modo desarrollo');
      console.error('   3. Necesitas solicitar acceso extendido en Spotify Dashboard');
      console.error('\n💡 Solución: Vuelve a conectarte desde el frontend con los nuevos scopes');
    }
  }

  // 3. Probar batch de audio-features
  try {
    console.log(`\n3️⃣ Probando batch de audio-features...`);
    const batchResponse = await axios.get('https://api.spotify.com/v1/audio-features', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      params: {
        ids: `${testTrackId},4iV5W9uYEdYUVa79Axb7Rh`,
      },
    });
    
    if (batchResponse.data.audio_features && batchResponse.data.audio_features.length > 0) {
      console.log(`✅ Batch de audio-features FUNCIONA!`);
      console.log(`   Tracks procesados: ${batchResponse.data.audio_features.length}`);
    }
  } catch (error: any) {
    console.error(`❌ Error en batch audio-features: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
  }
}

testTokenBPM().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});

