import dotenv from 'dotenv';
import { SupabaseService } from '../src/services/supabase';
import { SpotifyService } from '../src/services/spotify';
import * as readline from 'readline';

dotenv.config();

/**
 * Script para eliminar canciones que NO son de Dale Play Records
 * 
 * Este script:
 * 1. Verifica el label de todas las canciones
 * 2. Identifica las que NO son de Dale Play Records
 * 3. Pide confirmación antes de eliminar
 * 4. Elimina las canciones inválidas de Supabase
 * 
 * Uso:
 *   npm run remove-non-dale-play
 *   npm run remove-non-dale-play -- --auto (elimina sin confirmación)
 */

interface TrackWithLabel {
  spotify_id: string;
  name: string;
  artist_main: string;
  album: string;
  label: string | null;
  isDalePlay: boolean;
}

// Función para normalizar y comparar labels
const normalizeLabel = (label: string | null): string => {
  if (!label) return '';
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s]/g, '') // Remover caracteres especiales excepto espacios
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim();
};

// Función para verificar si un label es de Dale Play Records
const isDalePlayLabel = (label: string | null): boolean => {
  if (!label) return false;
  
  const normalized = normalizeLabel(label);
  
  // Verificar variaciones comunes
  const dalePlayVariations = [
    'dale play records',
    'dale play',
    'daleplay records',
    'daleplay',
  ];
  
  for (const variation of dalePlayVariations) {
    if (normalized.includes(variation)) {
      return true;
    }
  }
  
  // Verificar si contiene "dale" y "play"
  if (normalized.includes('dale') && normalized.includes('play')) {
    return true;
  }
  
  return false;
};

/**
 * Obtiene el label de un álbum consultando el track en Spotify
 */
async function getAlbumLabel(
  spotify: SpotifyService,
  trackId: string
): Promise<{ label: string | null; albumId: string | null } | null> {
  try {
    // Obtener información del track
    const trackResponse = await spotify.makeRequest<{
      album: {
        id: string;
        name: string;
        label?: string;
      };
    }>('get', `/tracks/${trackId}`);

    if (!trackResponse.album) {
      return null;
    }

    // Intentar obtener el label directamente del álbum
    let label = trackResponse.album.label || null;

    // Si no está en el track, intentar obtenerlo del álbum
    if (!label && trackResponse.album.id) {
      try {
        const albumResponse = await spotify.makeRequest<{
          label?: string;
          name: string;
        }>('get', `/albums/${trackResponse.album.id}`);
        
        label = albumResponse.label || null;
      } catch (error) {
        // Si falla, continuar sin label
      }
    }

    return {
      label: label || null,
      albumId: trackResponse.album.id,
    };
  } catch (error: any) {
    // Si el endpoint no está disponible o falla, retornar null
    return null;
  }
}

/**
 * Pregunta al usuario por confirmación
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'si' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function removeNonDalePlayTracks(autoConfirm: boolean = false) {
  console.log('🗑️  Iniciando eliminación de canciones que NO son de Dale Play Records...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`);

  const supabase = new SupabaseService();
  const spotify = new SpotifyService();

  // 1. Obtener todas las canciones
  console.log('📋 Obteniendo canciones de la base de datos...');
  const tracks = await supabase.getAllTracks();
  console.log(`✅ Encontradas ${tracks.length} canciones\n`);

  if (tracks.length === 0) {
    console.warn('⚠️  No hay canciones en la base de datos');
    return;
  }

  // 2. Verificar labels
  console.log('🔍 Verificando labels en Spotify...\n');
  const results: TrackWithLabel[] = [];
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const progress = `[${i + 1}/${tracks.length}]`;
    
    try {
      const albumInfo = await getAlbumLabel(spotify, track.spotify_id);
      const label = albumInfo?.label || null;
      const isDalePlay = isDalePlayLabel(label);

      results.push({
        spotify_id: track.spotify_id,
        name: track.name,
        artist_main: track.artist_main || 'N/A',
        album: track.album || 'N/A',
        label: albumInfo?.label || null,
        isDalePlay,
      });

      const status = isDalePlay ? '✅' : '❌';
      const labelDisplay = albumInfo?.label || 'NO ENCONTRADO';
      console.log(`${progress} ${status} ${track.name} - Label: ${labelDisplay}`);

      // Pequeña pausa para evitar rate limits
      if (i < tracks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error: any) {
      console.error(`${progress} ❌ Error verificando ${track.name}: ${error.message}`);
      results.push({
        spotify_id: track.spotify_id,
        name: track.name,
        artist_main: track.artist_main || 'N/A',
        album: track.album || 'N/A',
        label: null,
        isDalePlay: false,
      });
    }
  }

  // 3. Identificar canciones a eliminar
  const nonDalePlayTracks = results.filter(r => !r.isDalePlay);
  const noLabelTracks = results.filter(r => !r.label);

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RESUMEN DE VERIFICACIÓN');
  console.log('='.repeat(80));
  console.log(`✅ Canciones de Dale Play Records: ${results.filter(r => r.isDalePlay).length}`);
  console.log(`❌ Canciones de otros labels: ${nonDalePlayTracks.length}`);
  console.log(`⚠️  Canciones sin label: ${noLabelTracks.length}`);

  if (nonDalePlayTracks.length === 0 && noLabelTracks.length === 0) {
    console.log(`\n✅ Todas las canciones son de Dale Play Records. No hay nada que eliminar.`);
    return;
  }

  // 4. Mostrar canciones que se eliminarán
  const tracksToDelete = [...nonDalePlayTracks];
  
  if (tracksToDelete.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('🗑️  CANCIONES QUE SE ELIMINARÁN:');
    console.log('='.repeat(80));
    tracksToDelete.forEach((track, index) => {
      console.log(`\n${index + 1}. ${track.name}`);
      console.log(`   Artista: ${track.artist_main}`);
      console.log(`   Álbum: ${track.album}`);
      console.log(`   Label: ${track.label || 'NO ENCONTRADO'}`);
      console.log(`   Spotify ID: ${track.spotify_id}`);
    });
  }

  // 5. Confirmar eliminación
  if (!autoConfirm) {
    console.log(`\n⚠️  ADVERTENCIA: Se eliminarán ${tracksToDelete.length} canciones de la base de datos.`);
    const confirmed = await askConfirmation(`\n¿Deseas continuar? (s/n): `);
    
    if (!confirmed) {
      console.log('\n❌ Operación cancelada por el usuario.');
      return;
    }
  }

  // 6. Eliminar canciones
  if (tracksToDelete.length > 0) {
    console.log(`\n🗑️  Eliminando ${tracksToDelete.length} canciones...`);
    
    const spotifyIds = tracksToDelete.map(t => t.spotify_id);
    
    try {
      // Eliminar en batches de 50
      const batchSize = 50;
      let deletedCount = 0;
      
      for (let i = 0; i < spotifyIds.length; i += batchSize) {
        const batch = spotifyIds.slice(i, i + batchSize);
        
        // Eliminar una por una para mejor control de errores
        for (const spotifyId of batch) {
          try {
            const { error } = await supabase.client
              .from('artist_tracks')
              .delete()
              .eq('spotify_id', spotifyId);
            
            if (error) {
              console.error(`❌ Error eliminando ${spotifyId}:`, error.message);
            } else {
              deletedCount++;
              if (deletedCount % 10 === 0) {
                console.log(`✅ Eliminadas ${deletedCount}/${spotifyIds.length} canciones...`);
              }
            }
          } catch (err: any) {
            console.error(`❌ Error eliminando ${spotifyId}:`, err.message);
          }
        }
      }
      
      console.log(`\n✅ ${deletedCount} canciones eliminadas exitosamente`);
    } catch (error: any) {
      console.error(`\n❌ Error eliminando canciones:`, error.message);
      throw error;
    }
  } else {
    console.log(`\n✅ No hay canciones para eliminar`);
  }

  console.log(`\n✅ Proceso completado`);
}

// Parsear argumentos
const args = process.argv.slice(2);
const autoConfirm = args.includes('--auto') || args.includes('-y');

removeNonDalePlayTracks(autoConfirm).catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

