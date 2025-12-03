import dotenv from 'dotenv';
import { SpotifyService } from '../src/services/spotify';
import { SupabaseService } from '../src/services/supabase';
import { TrackData } from '../src/types';

dotenv.config();

/**
 * Script para buscar y guardar más canciones de los artistas que ya están en la base de datos
 * 
 * Este script:
 * 1. Obtiene todos los artistas únicos de la base de datos
 * 2. Para cada artista, busca más canciones usando búsquedas amplias
 * 3. Guarda las nuevas canciones en Supabase (evita duplicados)
 * 
 * Uso:
 *   npm run sync-more-tracks
 *   npm run sync-more-tracks -- --tracks-per-artist 20
 *   npm run sync-more-tracks -- --skip-bpm
 */

interface SyncOptions {
  tracksPerArtist?: number;
  skipBPM?: boolean;
}

async function syncMoreTracks(options: SyncOptions = {}) {
  const {
    tracksPerArtist = 20, // Más canciones por defecto
    skipBPM = true, // Saltar BPM por defecto
  } = options;

  console.log('🚀 Iniciando búsqueda de más canciones...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
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

  // 1. Obtener artistas de la base de datos
  console.log('📋 Obteniendo artistas de la base de datos...');
  let artists;
  try {
    artists = await supabase.getAllArtists();
    console.log(`✅ Encontrados ${artists.length} artistas en la base de datos\n`);
  } catch (error: any) {
    console.error(`❌ Error obteniendo artistas: ${error.message}`);
    process.exit(1);
  }

  if (artists.length === 0) {
    console.warn('⚠️  No hay artistas en la base de datos. Ejecuta primero sync-dale-play o sync.');
    process.exit(0);
  }

  const allTracks: TrackData[] = [];
  const results = {
    success: [] as string[],
    failed: [] as string[],
    totalTracks: 0,
    newTracks: 0,
  };

  // 2. Para cada artista, buscar más canciones
  for (let i = 0; i < artists.length; i++) {
    const artistName = artists[i].name;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 [${i + 1}/${artists.length}] Procesando: ${artistName}`);
    console.log('='.repeat(80));

    try {
      // Buscar artista en Spotify para obtener ID y géneros
      console.log(`🔍 Buscando artista en Spotify...`);
      const artist = await spotify.searchArtist(artistName);
      
      if (!artist) {
        console.warn(`⚠️  No se encontró en Spotify: ${artistName}`);
        results.failed.push(artistName);
        continue;
      }

      console.log(`✅ Encontrado: ${artist.name} (ID: ${artist.id}, Popularidad: ${artist.popularity})`);

      // Obtener información completa del artista
      console.log(`📋 Obteniendo información del artista...`);
      const fullArtistInfo = await spotify.getArtist(artist.id);
      const artistGenres = fullArtistInfo.genres;
      console.log(`✅ Géneros: ${artistGenres.length > 0 ? artistGenres.join(', ') : 'ninguno'}`);

      // Buscar tracks usando búsqueda amplia (más canciones que solo top tracks)
      console.log(`🎵 Buscando tracks de ${artistName}...`);
      const tracksFound = await searchTracksByArtist(spotify, artist.name, tracksPerArtist);
      console.log(`✅ Encontrados ${tracksFound.length} tracks`);

      if (tracksFound.length === 0) {
        console.warn(`⚠️  No se encontraron tracks para ${artistName}`);
        results.failed.push(artistName);
        continue;
      }

      // Obtener BPM (opcional)
      const trackIds = tracksFound.map((t) => t.id);
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

      // Procesar tracks
      console.log(`🔄 Procesando ${tracksFound.length} tracks...`);
      let skippedTracks = 0;
      for (const track of tracksFound) {
        // Verificar que el artista buscado esté en la lista de artistas del track
        const trackArtists = track.artists.map((a: any) => a.name.toLowerCase().trim());
        const searchArtistName = artistName.toLowerCase().trim();
        
        if (!trackArtists.includes(searchArtistName)) {
          console.log(`     ⚠️  Omitiendo "${track.name}": el artista "${artistName}" no está en la lista de artistas (${track.artists.map((a: any) => a.name).join(', ')})`);
          skippedTracks++;
          continue;
        }
        
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
      
      if (skippedTracks > 0) {
        console.log(`   ⚠️  ${skippedTracks} tracks omitidos porque "${artistName}" no es artista principal`);
      }

      console.log(`✅ ${tracksFound.length} tracks procesados para ${artistName}`);
      results.success.push(artistName);
      results.totalTracks += tracksFound.length;

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

  // 3. Guardar todo en Supabase
  if (allTracks.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`💾 Guardando ${allTracks.length} tracks en Supabase...`);
    console.log('='.repeat(80));
    
    try {
      const savedCount = await supabase.upsertTracks(allTracks);
      console.log(`✅ ${savedCount} tracks guardados exitosamente en Supabase (de ${allTracks.length} procesados)`);
      results.newTracks = savedCount;
    } catch (error: any) {
      console.error(`❌ Error guardando en Supabase:`, error.message);
      throw error;
    }
  } else {
    console.warn(`\n⚠️  No hay tracks para guardar`);
  }

  // 4. Resumen
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 RESUMEN`);
  console.log('='.repeat(80));
  console.log(`✅ Artistas exitosos: ${results.success.length}`);
  if (results.success.length > 0) {
    console.log(`   ${results.success.join(', ')}`);
  }
  console.log(`❌ Artistas fallidos: ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log(`   ${results.failed.join(', ')}`);
  }
  console.log(`📦 Total tracks procesados: ${results.totalTracks}`);
  console.log(`🆕 Tracks nuevos guardados: ${results.newTracks}`);
  console.log(`\n✅ Proceso completado!`);
}

/**
 * Busca tracks de un artista usando búsquedas amplias
 * Combina top tracks + búsquedas por nombre para obtener más canciones
 */
async function searchTracksByArtist(
  spotify: SpotifyService,
  artistName: string,
  maxTracks: number
): Promise<any[]> {
  const allTracks = new Map<string, any>();

  try {
    // 1. Obtener top tracks (hasta 10)
    const topTracks = await spotify.getArtistTopTracks(
      (await spotify.searchArtist(artistName))?.id || ''
    );
    topTracks.forEach(track => {
      allTracks.set(track.id, track);
    });
    console.log(`   📊 Top tracks obtenidos: ${topTracks.length}`);

    // 2. Buscar más tracks usando búsqueda por artista
    // Spotify permite hasta 50 resultados por búsqueda, pero hacemos múltiples búsquedas
    const searchQueries = [
      `artist:"${artistName}"`,
      `artist:${artistName}`,
    ];

    for (const query of searchQueries) {
      if (allTracks.size >= maxTracks) break;

      try {
        const response = await spotify.makeRequest<{
          tracks: {
            items: Array<{
              id: string;
              name: string;
              artists: Array<{ id: string; name: string }>;
              album: {
                name: string;
                release_date: string;
                images: Array<{ url: string }>;
              };
              duration_ms: number;
              preview_url: string | null;
            }>;
            next: string | null;
          };
        }>('get', '/search', {
          q: query,
          type: 'track',
          limit: 50,
          market: 'AR',
        });

        if (response.tracks?.items) {
          response.tracks.items.forEach((track: any) => {
            if (allTracks.size < maxTracks) {
              // Verificar que el artista principal esté en la lista de artistas del track
              const trackArtists = track.artists.map((a: any) => a.name.toLowerCase());
              if (trackArtists.includes(artistName.toLowerCase())) {
                allTracks.set(track.id, {
                  id: track.id,
                  name: track.name,
                  artists: track.artists.map((a: any) => ({ id: a.id, name: a.name })),
                  album: {
                    name: track.album.name,
                    release_date: track.album.release_date,
                    images: track.album.images,
                  },
                  duration_ms: track.duration_ms,
                  preview_url: track.preview_url,
                });
              }
            }
          });
          console.log(`   🔍 Búsqueda "${query}": ${response.tracks.items.length} resultados`);
        }

        // Pequeña pausa entre búsquedas
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.warn(`   ⚠️  Error en búsqueda "${query}": ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error(`   ❌ Error buscando tracks: ${error.message}`);
  }

  return Array.from(allTracks.values()).slice(0, maxTracks);
}

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);
const options: SyncOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tracks-per-artist' && args[i + 1]) {
    options.tracksPerArtist = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--with-bpm') {
    options.skipBPM = false;
  } else if (args[i] === '--skip-bpm') {
    options.skipBPM = true;
  }
}

syncMoreTracks(options).catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

