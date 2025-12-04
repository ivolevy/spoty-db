import dotenv from 'dotenv';
import { SpotifyService } from '../src/services/spotify';
import { SupabaseService } from '../src/services/supabase';
import { TrackData } from '../src/types';

dotenv.config();

/**
 * Script para buscar más canciones de artistas específicos
 * Busca canciones ampliamente y las guarda en Supabase
 * 
 * Uso:
 *   npm run sync-specific-artists
 *   npm run sync-specific-artists -- --tracks-per-artist 30
 *   npm run sync-specific-artists -- --with-bpm
 */

// Artistas específicos a buscar
const TARGET_ARTISTS = [
  'Airbag',
  'Duki',
  'Nicki Nicole',
  'Bizarrap',
];

interface SyncOptions {
  tracksPerArtist?: number;
  skipBPM?: boolean;
}

async function syncSpecificArtists(options: SyncOptions = {}) {
  const {
    tracksPerArtist = 30, // Más canciones por defecto para búsqueda amplia
    skipBPM = true, // Saltar BPM por defecto
  } = options;

  console.log('🚀 Iniciando búsqueda de canciones para artistas específicos...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🎤 Artistas a procesar: ${TARGET_ARTISTS.length}`);
  console.log(`   ${TARGET_ARTISTS.join(', ')}`);
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
    newTracks: 0,
  };

  // Procesar cada artista
  for (let i = 0; i < TARGET_ARTISTS.length; i++) {
    const artistName = TARGET_ARTISTS[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 [${i + 1}/${TARGET_ARTISTS.length}] Procesando: ${artistName}`);
    console.log('='.repeat(80));

    try {
      // 1. Buscar artista en Spotify
      console.log(`🔍 Buscando artista en Spotify...`);
      const artist = await spotify.searchArtist(artistName);
      
      if (!artist) {
        console.warn(`⚠️  No se encontró en Spotify: ${artistName}`);
        results.failed.push(artistName);
        continue;
      }

      console.log(`✅ Encontrado: ${artist.name} (ID: ${artist.id}, Popularidad: ${artist.popularity})`);

      // 2. Obtener información completa del artista
      console.log(`📋 Obteniendo información del artista...`);
      const fullArtistInfo = await spotify.getArtist(artist.id);
      const artistGenres = fullArtistInfo.genres;
      console.log(`✅ Géneros: ${artistGenres.length > 0 ? artistGenres.join(', ') : 'ninguno'}`);

      // 3. Buscar tracks usando búsqueda amplia
      console.log(`🎵 Buscando tracks de ${artist.name}...`);
      const tracksFound = await searchTracksByArtist(spotify, artist.name, tracksPerArtist);
      console.log(`✅ Encontrados ${tracksFound.length} tracks`);

      if (tracksFound.length === 0) {
        console.warn(`⚠️  No se encontraron tracks para ${artist.name}`);
        results.failed.push(artist.name);
        continue;
      }

      // 4. Obtener BPM (opcional)
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

      // 5. Procesar tracks
      console.log(`🔄 Procesando ${tracksFound.length} tracks...`);
      const normalizedArtistName = artist.name.toLowerCase().trim();
      let validTracksCount = 0;
      
      for (const track of tracksFound) {
        // Validar que el artista buscado sea el artista principal (primer artista)
        if (!track.artists || track.artists.length === 0) {
          console.warn(`   ⚠️  Track "${track.name}" sin artistas, omitiendo...`);
          continue;
        }
        
        const firstArtistName = track.artists[0].name.toLowerCase().trim();
        if (firstArtistName !== normalizedArtistName) {
          console.warn(`   ⚠️  Track "${track.name}" tiene como artista principal a "${track.artists[0].name}" (no "${artist.name}"), omitiendo...`);
          continue;
        }
        
        const bpm = audioFeaturesMap.get(track.id) || null;
        const previewUrl = track.preview_url || null;

        const trackData: TrackData = {
          spotify_id: track.id,
          name: track.name,
          artists: track.artists.map((a: any) => a.name),
          artist_main: artist.name, // Usar el nombre del artista encontrado en Spotify
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
        validTracksCount++;
      }
      
      if (validTracksCount < tracksFound.length) {
        console.warn(`   ⚠️  Se omitieron ${tracksFound.length - validTracksCount} tracks que no pertenecen al artista principal`);
      }

      console.log(`✅ ${validTracksCount} tracks válidos procesados para ${artist.name} (de ${tracksFound.length} encontrados)`);
      results.success.push(artist.name);
      results.totalTracks += validTracksCount;

      // Pausa para evitar rate limits
      if (i < TARGET_ARTISTS.length - 1) {
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

  // 7. Resumen
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
  console.log(`\n💡 Próximo paso: Ejecuta 'npm run verify-label' para verificar qué canciones son de Dale Play Records`);
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
              // Verificar que el artista buscado sea el artista PRINCIPAL (primer artista)
              // Esto evita incluir tracks donde el artista es solo colaborador
              if (track.artists && track.artists.length > 0) {
                const mainArtist = track.artists[0].name.toLowerCase().trim();
                const searchedArtist = artistName.toLowerCase().trim();
                
                if (mainArtist === searchedArtist) {
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

syncSpecificArtists(options).catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

