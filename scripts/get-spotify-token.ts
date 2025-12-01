import dotenv from 'dotenv';
import axios from 'axios';
import * as readline from 'readline';

dotenv.config();

/**
 * Script para obtener un token de usuario de Spotify manualmente
 * 
 * Uso:
 *   npm run get-token
 * 
 * Esto te dará una URL para autorizar y luego podrás copiar el token
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback';

  if (!clientId || !clientSecret) {
    console.error('❌ Error: SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET deben estar en .env');
    process.exit(1);
  }

  console.log('\n🔐 Obtener Token de Usuario de Spotify\n');
  console.log('Este script te ayudará a obtener un token de usuario para acceder a BPM.\n');

  // Opción 1: Usar la consola de Spotify (más fácil)
  console.log('📋 OPCIÓN 1: Usar la Consola de Spotify (RECOMENDADO)\n');
  console.log('1. Ve a: https://developer.spotify.com/console/get-audio-features/');
  console.log('2. Click en "Get Token"');
  console.log('3. Autoriza la aplicación');
  console.log('4. Copia el token que aparece');
  console.log('5. Pégalo aquí abajo\n');

  const token = await question('Pega el token aquí: ');

  if (!token || token.trim().length < 10) {
    console.error('❌ Token inválido');
    process.exit(1);
  }

  // Verificar que el token funciona
  console.log('\n🔍 Verificando token...');
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
      },
    });

    console.log('✅ Token válido!');
    console.log(`   Usuario: ${response.data.display_name || response.data.id}`);
    console.log(`   Email: ${response.data.email || 'No disponible'}`);

    // Probar obtener audio features
    console.log('\n🎚️  Probando acceso a audio-features...');
    try {
      // Usar un track conocido para probar
      const testResponse = await axios.get('https://api.spotify.com/v1/audio-features/4iV5W9uYEdYUVa79Axb7Rh', {
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
        },
      });

      if (testResponse.data.tempo) {
        console.log(`✅ Audio-features funciona! BPM del track de prueba: ${Math.round(testResponse.data.tempo)}`);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn('⚠️  El token no tiene acceso a audio-features (403 Forbidden)');
        console.warn('   Esto puede significar que necesitas permisos especiales');
      } else {
        console.warn(`⚠️  Error probando audio-features: ${error.message}`);
      }
    }

    // Guardar en .env
    console.log('\n💾 Guardando token en .env...');
    const fs = require('fs');
    const envPath = '.env';
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Remover SPOTIFY_USER_TOKEN si existe
    envContent = envContent.replace(/SPOTIFY_USER_TOKEN=.*\n/g, '');
    
    // Agregar el nuevo token
    envContent += `\nSPOTIFY_USER_TOKEN=${token.trim}\n`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Token guardado en .env como SPOTIFY_USER_TOKEN');
    console.log('\n📝 Ahora puedes usar:');
    console.log('   npm run manual-sync "Duki"');
    console.log('   npm run sync');
    console.log('\n⚠️  Nota: Este token expira en ~1 hora. Necesitarás renovarlo después.');

  } catch (error: any) {
    console.error('❌ Error verificando token:', error.message);
    if (error.response?.status === 401) {
      console.error('   El token es inválido o expiró');
    }
    process.exit(1);
  }

  rl.close();
}

getSpotifyToken().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});

