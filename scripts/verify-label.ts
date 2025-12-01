import dotenv from 'dotenv';
import { SupabaseService } from '../src/services/supabase';
import { SpotifyService } from '../src/services/spotify';

dotenv.config();

/**
 * Script para verificar el label de las canciones en la base de datos
 * 
 * Este script:
 * 1. Obtiene todas las canciones de la BD
 * 2. Para cada canción, consulta Spotify para obtener el label del álbum
 * 3. Verifica si el label coincide con "Dale Play Records"
 * 4. Muestra un reporte de canciones que NO son del label correcto
 * 
 * Uso:
 *   npm run verify-label
 */

interface TrackWithLabel {
  spotify_id: string;
  name: string;
  artist_main: string;
  album: string;
  label: string | null;
  isDalePlay: boolean;
}

async function verifyLabels() {
  console.log('🔍 Iniciando verificación de labels...');
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

  const results: TrackWithLabel[] = [];
  
  // Lista de variaciones posibles del label (case-insensitive)
  const dalePlayLabels = [
    'dale play records',
    'dale play',
    'daleplay records',
    'daleplay',
    'd.a.l.e play records',
    'd.a.l.e play',
  ];
  
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
    
    // Verificar coincidencias exactas
    for (const dpl of dalePlayLabels) {
      if (normalized.includes(dpl.toLowerCase())) {
        return true;
      }
    }
    
    // Verificar variaciones comunes
    // "dale play" puede aparecer en cualquier parte del string
    if (normalized.includes('dale') && normalized.includes('play')) {
      return true;
    }
    
    return false;
  };

  // 2. Para cada canción, obtener el label del álbum
  console.log('🔍 Verificando labels en Spotify...\n');
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const progress = `[${i + 1}/${tracks.length}]`;
    
    try {
      // Obtener información del álbum desde Spotify
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

  // 3. Generar reporte
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 REPORTE DE VERIFICACIÓN DE LABELS');
  console.log('='.repeat(80));

  const dalePlayTracks = results.filter(r => r.isDalePlay);
  const nonDalePlayTracks = results.filter(r => !r.isDalePlay);
  const noLabelTracks = results.filter(r => !r.label);

  console.log(`\n✅ Canciones de Dale Play Records: ${dalePlayTracks.length} (${((dalePlayTracks.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Canciones de otros labels: ${nonDalePlayTracks.length} (${((nonDalePlayTracks.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Canciones sin label: ${noLabelTracks.length} (${((noLabelTracks.length / results.length) * 100).toFixed(1)}%)`);

  if (nonDalePlayTracks.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('❌ CANCIONES QUE NO SON DE DALE PLAY RECORDS:');
    console.log('='.repeat(80));
    nonDalePlayTracks.forEach(track => {
      console.log(`\n📀 ${track.name}`);
      console.log(`   Artista: ${track.artist_main}`);
      console.log(`   Álbum: ${track.album}`);
      console.log(`   Label: ${track.label || 'NO ENCONTRADO'}`);
      console.log(`   Spotify ID: ${track.spotify_id}`);
    });
  }

  if (noLabelTracks.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('⚠️  CANCIONES SIN LABEL (no se pudo verificar):');
    console.log('='.repeat(80));
    noLabelTracks.forEach(track => {
      console.log(`\n📀 ${track.name}`);
      console.log(`   Artista: ${track.artist_main}`);
      console.log(`   Álbum: ${track.album}`);
      console.log(`   Spotify ID: ${track.spotify_id}`);
    });
  }

  console.log(`\n✅ Verificación completada`);
}

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
        external_ids?: Record<string, string>;
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

verifyLabels().catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

