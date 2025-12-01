import dotenv from 'dotenv';
import { SupabaseService } from '../src/services/supabase';

dotenv.config();

/**
 * Script para verificar que todas las canciones sean de artistas de Dale Play Records
 * 
 * Este script verifica que todas las canciones en la BD pertenezcan a artistas
 * conocidos de Dale Play Records.
 * 
 * Uso:
 *   npm run verify-dale-play-artists
 */

// Lista oficial de artistas de Dale Play Records
const DALE_PLAY_ARTISTS = [
  'Duki',
  'Bizarrap',
  'Nicki Nicole',
  'Paulo Londra',
  'Rels B',
  'Airbag',
  'Lali',
  'Milo j',
  'Milo J',
  'Rei Delaossa',
  'LUANA',
  'Taichu',
  'Urbanse',
  'Lautaro LR',
  'Emilia',
];

async function verifyDalePlayArtists() {
  console.log('🔍 Verificando que todas las canciones sean de artistas de Dale Play Records...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`);

  const supabase = new SupabaseService();

  // 1. Obtener todas las canciones
  console.log('📋 Obteniendo canciones de la base de datos...');
  const tracks = await supabase.getAllTracks();
  console.log(`✅ Encontradas ${tracks.length} canciones\n`);

  if (tracks.length === 0) {
    console.warn('⚠️  No hay canciones en la base de datos');
    return;
  }

  // 2. Normalizar nombres de artistas para comparación (sin acentos, minúsculas)
  const normalizeName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .trim();
  };

  const dalePlayArtistsNormalized = DALE_PLAY_ARTISTS.map(normalizeName);
  
  // 3. Verificar cada canción
  const validTracks: any[] = [];
  const invalidTracks: any[] = [];
  const artistStats: Record<string, number> = {};

  console.log('🔍 Verificando artistas...\n');

  for (const track of tracks) {
    const artistMain = track.artist_main || '';
    const artistMainNormalized = normalizeName(artistMain);
    
    // Verificar si el artista principal está en la lista
    const isValid = dalePlayArtistsNormalized.includes(artistMainNormalized);
    
    // También verificar en el array de artistas (por si hay colaboraciones)
    let isValidInArtists = false;
    if (track.artists && Array.isArray(track.artists)) {
      isValidInArtists = track.artists.some(artist => 
        dalePlayArtistsNormalized.includes(normalizeName(artist))
      );
    }

    const isDalePlay = isValid || isValidInArtists;

    if (isDalePlay) {
      validTracks.push(track);
      artistStats[artistMain] = (artistStats[artistMain] || 0) + 1;
    } else {
      invalidTracks.push(track);
    }
  }

  // 4. Generar reporte
  console.log(`${'='.repeat(80)}`);
  console.log('📊 REPORTE DE VERIFICACIÓN');
  console.log('='.repeat(80));

  console.log(`\n✅ Canciones de artistas de Dale Play Records: ${validTracks.length} (${((validTracks.length / tracks.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Canciones de otros artistas: ${invalidTracks.length} (${((invalidTracks.length / tracks.length) * 100).toFixed(1)}%)`);

  if (invalidTracks.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('❌ CANCIONES QUE NO SON DE ARTISTAS DE DALE PLAY RECORDS:');
    console.log('='.repeat(80));
    
    // Agrupar por artista
    const invalidByArtist: Record<string, any[]> = {};
    invalidTracks.forEach(track => {
      const artist = track.artist_main || 'Sin artista';
      if (!invalidByArtist[artist]) {
        invalidByArtist[artist] = [];
      }
      invalidByArtist[artist].push(track);
    });

    Object.entries(invalidByArtist).forEach(([artist, artistTracks]) => {
      console.log(`\n🎤 ${artist} (${artistTracks.length} canciones):`);
      artistTracks.forEach(track => {
        console.log(`   - ${track.name} (Álbum: ${track.album || 'N/A'})`);
      });
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 ESTADÍSTICAS POR ARTISTA (Dale Play Records):');
  console.log('='.repeat(80));
  
  const sortedArtists = Object.entries(artistStats)
    .sort((a, b) => b[1] - a[1]);
  
  sortedArtists.forEach(([artist, count]) => {
    console.log(`   ${artist}: ${count} canciones`);
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('📋 ARTISTAS OFICIALES DE DALE PLAY RECORDS:');
  console.log('='.repeat(80));
  DALE_PLAY_ARTISTS.forEach((artist, index) => {
    const count = artistStats[artist] || 0;
    const status = count > 0 ? '✅' : '⚠️';
    console.log(`   ${status} ${artist}${count > 0 ? ` (${count} canciones)` : ' (sin canciones)'}`);
  });

  console.log(`\n✅ Verificación completada`);
  
  if (invalidTracks.length > 0) {
    console.log(`\n⚠️  RECOMENDACIÓN: Considera eliminar las ${invalidTracks.length} canciones que no son de artistas de Dale Play Records.`);
  }
}

verifyDalePlayArtists().catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

