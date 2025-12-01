import dotenv from 'dotenv';
import { SpotifyService } from '../src/services/spotify';
import { SupabaseService } from '../src/services/supabase';
import { TrackData } from '../src/types';

dotenv.config();

/**
 * Script para buscar tracks manualmente y guardarlos en Supabase
 * 
 * Uso:
 *   npm run manual-sync "nombre del artista" "nombre de la canción"
 *   npm run manual-sync "Duki" "She Don't Give a FO"
 *   npm run manual-sync "Bizarrap" "Bzrp Music Sessions"
 */

async function searchAndSaveTrack(artistName: string, trackName?: string) {
  console.log('🚀 Iniciando búsqueda manual...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🎤 Artista: ${artistName}`);
  if (trackName) {
    console.log(`🎵 Track: ${trackName}`);
  }

  const spotify = new SpotifyService();
  const supabase = new SupabaseService();

  // Si hay token de usuario en .env, usarlo
  if (process.env.SPOTIFY_USER_TOKEN) {
    const token = process.env.SPOTIFY_USER_TOKEN.trim();
    spotify.setUserToken(token);
    console.log('✅ Token de usuario cargado desde .env');
    console.log(`   Token (primeros 20 chars): ${token.substring(0, 20)}...`);
    
    // Verificar que el token se guardó correctamente
    const savedToken = spotify.getUserToken();
    if (savedToken === token) {
      console.log('   ✅ Token verificado correctamente');
    } else {
      console.warn('   ⚠️  El token no se guardó correctamente');
    }
  } else {
    console.warn('⚠️  No hay SPOTIFY_USER_TOKEN en .env. BPM no estará disponible.');
    console.warn('   Ejecuta: npm run get-token');
  }

  try {
    // 1. Buscar artista
    console.log(`\n🔍 Buscando artista "${artistName}"...`);
    const artist = await spotify.searchArtist(artistName);
    
    if (!artist) {
      console.error(`❌ No se encontró el artista: ${artistName}`);
      return;
    }

    console.log(`✅ Artista encontrado: ${artist.name} (ID: ${artist.id})`);

    // 2. Obtener información completa del artista
    console.log(`📋 Obteniendo información del artista...`);
    const fullArtistInfo = await spotify.getArtist(artist.id);
    const artistGenres = fullArtistInfo.genres;
    console.log(`✅ Géneros: ${artistGenres.length > 0 ? artistGenres.join(', ') : 'ninguno'}`);

    let tracks: any[] = [];

    if (trackName) {
      // Buscar track específico
      console.log(`\n🔍 Buscando track "${trackName}" de ${artist.name}...`);
      const searchResponse = await spotify.makeRequest<any>('get', '/search', {
        q: `artist:${artist.name} track:${trackName}`,
        type: 'track',
        limit: 5,
      });

      if (searchResponse.tracks?.items?.length > 0) {
        tracks = searchResponse.tracks.items.slice(0, 5).map((track: any) => ({
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
        }));
        console.log(`✅ Encontrados ${tracks.length} tracks`);
      } else {
        console.warn(`⚠️  No se encontraron tracks con ese nombre`);
      }
    } else {
      // Obtener top tracks del artista
      console.log(`\n🎵 Obteniendo top tracks del artista...`);
      tracks = await spotify.getArtistTopTracks(artist.id);
      console.log(`✅ Encontrados ${tracks.length} tracks`);
    }

    if (tracks.length === 0) {
      console.warn(`⚠️  No hay tracks para guardar`);
      return;
    }

    // 3. Obtener audio features (BPM)
    const trackIds = tracks.map((t) => t.id);
    console.log(`\n🎚️  Obteniendo audio features para ${trackIds.length} tracks...`);
    let audioFeaturesMap = new Map<string, number>();
    
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

    // 4. Procesar tracks
    console.log(`\n🔄 Procesando ${tracks.length} tracks...`);
    const tracksToSave: TrackData[] = [];

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

      tracksToSave.push(trackData);

      console.log(`   ${bpm ? `✅ ${track.name}: ${Math.round(bpm)} BPM` : `⚠️  ${track.name}: Sin BPM`}${previewUrl ? ' + preview' : ''}`);
    }

    // 5. Guardar en Supabase
    console.log(`\n💾 Guardando ${tracksToSave.length} tracks en Supabase...`);
    await supabase.upsertTracks(tracksToSave);
    console.log(`✅ ${tracksToSave.length} tracks guardados exitosamente en Supabase`);

    console.log(`\n✅ Proceso completado exitosamente!`);
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Uso:
  npm run manual-sync "nombre del artista"
  npm run manual-sync "nombre del artista" "nombre de la canción"

Ejemplos:
  npm run manual-sync "Duki"
  npm run manual-sync "Duki" "She Don't Give a FO"
  npm run manual-sync "Bizarrap" "Bzrp Music Sessions"
  npm run manual-sync "Airbag"
  npm run manual-sync "Emilia"
  `);
  process.exit(1);
}

const artistName = args[0];
const trackName = args[1];

searchAndSaveTrack(artistName, trackName).catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});

