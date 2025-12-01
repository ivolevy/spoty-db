import dotenv from 'dotenv';
import { SpotifyService } from '../src/services/spotify';
import { SupabaseService } from '../src/services/supabase';
import { TrackData } from '../src/types';

dotenv.config();

/**
 * Script para sincronizar múltiples artistas de Dale Play Records
 * Obtiene más canciones por artista y las guarda en Supabase
 * 
 * Uso:
 *   npm run sync-dale-play
 *   npm run sync-dale-play -- --artists "Duki,Bizarrap,Airbag"
 *   npm run sync-dale-play -- --tracks-per-artist 10
 */

// Lista completa de artistas de Dale Play Records
const DALE_PLAY_ARTISTS = [
  'Duki',
  'Bizarrap',
  'Nicki Nicole',
  'Paulo Londra',
  'Rels B',
  'Airbag',
  'Lali',
  'Milo j',
  'Rei Delaossa',
  'LUANA',
  'Taichu',
  'Urbanse',
  'Lautaro LR',
  'Emilia',
];

interface SyncOptions {
  artists?: string[];
  tracksPerArtist?: number;
  skipBPM?: boolean;
}

async function syncDalePlayArtists(options: SyncOptions = {}) {
  const {
    artists = DALE_PLAY_ARTISTS,
    tracksPerArtist = 10, // Más canciones por defecto
    skipBPM = true, // Saltar BPM por ahora
  } = options;

  console.log('🚀 Iniciando sincronización de Dale Play Records...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🎤 Artistas a procesar: ${artists.length}`);
  console.log(`📊 Canciones por artista: ${tracksPerArtist}`);
  console.log(`🎚️  BPM: ${skipBPM ? 'DESHABILITADO' : 'HABILITADO'}\n`);

  const spotify = new SpotifyService();
  const supabase = new SupabaseService();

  // Cargar token de usuario si está disponible
  if (process.env.SPOTIFY_USER_TOKEN) {
    spotify.setUserToken(process.env.SPOTIFY_USER_TOKEN.trim());
    console.log('✅ Token de usuario cargado desde .env\n');
  } else {
    console.warn('⚠️  No hay SPOTIFY_USER_TOKEN. Continuando sin BPM.\n');
  }

  const allTracks: TrackData[] = [];
  const results = {
    success: [] as string[],
    failed: [] as string[],
    totalTracks: 0,
  };

  for (let i = 0; i < artists.length; i++) {
    const artistName = artists[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 [${i + 1}/${artists.length}] Procesando: ${artistName}`);
    console.log('='.repeat(80));

    try {
      // 1. Buscar artista
      console.log(`🔍 Buscando artista...`);
      const artist = await spotify.searchArtist(artistName);
      
      if (!artist) {
        console.warn(`⚠️  No se encontró: ${artistName}`);
        results.failed.push(artistName);
        continue;
      }

      console.log(`✅ Encontrado: ${artist.name} (ID: ${artist.id}, Popularidad: ${artist.popularity})`);

      // 2. Obtener información completa
      console.log(`📋 Obteniendo información del artista...`);
      const fullArtistInfo = await spotify.getArtist(artist.id);
      const artistGenres = fullArtistInfo.genres;
      console.log(`✅ Géneros: ${artistGenres.length > 0 ? artistGenres.join(', ') : 'ninguno'}`);

      // 3. Obtener top tracks (más canciones)
      console.log(`🎵 Obteniendo top ${tracksPerArtist} tracks...`);
      const topTracks = await spotify.getArtistTopTracks(artist.id);
      
      // Tomar solo el número solicitado
      const tracks = topTracks.slice(0, tracksPerArtist);
      console.log(`✅ Encontrados ${tracks.length} tracks (de ${topTracks.length} disponibles)`);

      if (tracks.length === 0) {
        console.warn(`⚠️  No hay tracks para ${artistName}`);
        results.failed.push(artistName);
        continue;
      }

      // 4. Obtener BPM (opcional, puede fallar)
      const trackIds = tracks.map((t) => t.id);
      let audioFeaturesMap = new Map<string, number>();
      
      if (!skipBPM) {
        console.log(`🎚️  Obteniendo audio features para ${trackIds.length} tracks...`);
        try {
          const audioFeatures = await spotify.getAudioFeatures(trackIds);
          audioFeaturesMap = new Map(
            audioFeatures.map((af) => [af.id, af.tempo])
          );
          if (audioFeaturesMap.size > 0) {
            console.log(`✅ Obtenidos ${audioFeaturesMap.size} BPM`);
          }
        } catch (error: any) {
          console.warn(`⚠️  No se pudieron obtener BPM: ${error.message}`);
          console.warn(`   Continuando sin BPM...`);
        }
      }

      // 5. Procesar tracks
      console.log(`🔄 Procesando ${tracks.length} tracks...`);
      for (const track of tracks) {
        const bpm = audioFeaturesMap.get(track.id) || null;
        const previewUrl = track.preview_url || null;

        const trackData: TrackData = {
          spotify_id: track.id,
          name: track.name,
          artists: track.artists.map((a: any) => a.name),
          artist_main: artistName,
          album: track.album.name,
          release_date: track.album.release_date || null,
          duration_ms: track.duration_ms,
          bpm: bpm,
          genres: artistGenres,
          preview_url: previewUrl,
          cover_url:
            track.album.images && track.album.images.length > 0
              ? track.album.images[0].url
              : null,
        };

        allTracks.push(trackData);
      }

      console.log(`✅ ${tracks.length} tracks procesados para ${artistName}`);
      results.success.push(artistName);
      results.totalTracks += tracks.length;

      // Pausa para evitar rate limits
      if (i < artists.length - 1) {
        console.log(`⏳ Esperando 1 segundo antes del siguiente artista...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error: any) {
      console.error(`❌ Error procesando ${artistName}:`, error.message);
      results.failed.push(artistName);
      continue;
    }
  }

  // 6. Guardar todo en Supabase
  if (allTracks.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`💾 Guardando ${allTracks.length} tracks en Supabase...`);
    console.log('='.repeat(80));
    
    try {
      await supabase.upsertTracks(allTracks);
      console.log(`✅ ${allTracks.length} tracks guardados exitosamente en Supabase`);
    } catch (error: any) {
      console.error(`❌ Error guardando en Supabase:`, error.message);
      throw error;
    }
  } else {
    console.warn(`\n⚠️  No hay tracks para guardar`);
  }

  // 7. Resumen
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 RESUMEN`);
  console.log('='.repeat(80));
  console.log(`✅ Artistas exitosos: ${results.success.length}`);
  console.log(`   ${results.success.join(', ')}`);
  console.log(`❌ Artistas fallidos: ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log(`   ${results.failed.join(', ')}`);
  }
  console.log(`📦 Total tracks guardados: ${results.totalTracks}`);
  console.log(`\n✅ Proceso completado!`);
}

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);
const options: SyncOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--artists' && args[i + 1]) {
    options.artists = args[i + 1].split(',').map(a => a.trim());
    i++;
  } else if (args[i] === '--tracks-per-artist' && args[i + 1]) {
    options.tracksPerArtist = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--with-bpm') {
    options.skipBPM = false;
  }
}

syncDalePlayArtists(options).catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

