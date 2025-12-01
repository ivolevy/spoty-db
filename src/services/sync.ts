import { SpotifyService } from './spotify';
import { SupabaseService } from './supabase';
import { TrackData } from '../types';

const ARTISTS = ['Duki', 'Bizarrap', 'Airbag', 'Emilia'];

export class SyncService {
  private spotify: SpotifyService;
  private supabase: SupabaseService;

  constructor() {
    this.spotify = new SpotifyService();
    this.supabase = new SupabaseService();
  }

  /**
   * Función principal de sincronización
   */
  async syncArtists(): Promise<void> {
    console.log('🚀 Iniciando sincronización de artistas...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    const allTracks: TrackData[] = [];

    for (const artistName of ARTISTS) {
      try {
        console.log(`\n🎤 Procesando artista: ${artistName}`);

        // 1. Buscar el ID del artista
        const artist = await this.spotify.searchArtist(artistName);
        if (!artist) {
          console.warn(`⚠️  No se encontró el artista: ${artistName}`);
          continue;
        }

        console.log(`   ✅ Artista encontrado: ${artist.name} (ID: ${artist.id})`);

        // 2. Obtener información completa del artista (para géneros)
        const fullArtistInfo = await this.spotify.getArtist(artist.id);
        const artistGenres = fullArtistInfo.genres || [];
        
        if (artistGenres.length > 0) {
          console.log(`   🎵 Géneros del artista: ${artistGenres.join(', ')}`);
        } else {
          console.warn(`   ⚠️  No se encontraron géneros para ${artistName}`);
        }

        // 3. Obtener los top 5 tracks
        const tracks = await this.spotify.getArtistTopTracks(artist.id);
        console.log(`   📦 Encontrados ${tracks.length} tracks`);

        if (tracks.length === 0) {
          console.warn(`   ⚠️  No se encontraron tracks para ${artistName}`);
          continue;
        }

        // 4. Obtener audio features (BPM) para todos los tracks
        const trackIds = tracks.map((t) => t.id);
        let audioFeaturesMap = new Map<string, number>();
        try {
          const audioFeatures = await this.spotify.getAudioFeatures(trackIds);
          audioFeaturesMap = new Map(
            audioFeatures.map((af) => [af.id, af.tempo])
          );
          if (audioFeaturesMap.size > 0) {
            console.log(`   ✅ Obtenidos ${audioFeaturesMap.size} BPM de ${trackIds.length} tracks`);
          }
        } catch (error: any) {
          console.warn(`   ⚠️  No se pudieron obtener BPM (403 Forbidden - puede requerir permisos especiales en Spotify Dashboard)`);
          console.warn(`   ℹ️  Continuando sin BPM. Las tracks se guardarán igual.`);
          // Continuar sin BPM si falla
        }

        // 5. Procesar cada track
        for (const track of tracks) {
          const bpm = audioFeaturesMap.get(track.id) || null;
          const previewUrl = track.preview_url || null;
          
          const trackData: TrackData = {
            spotify_id: track.id,
            name: track.name,
            artists: track.artists.map((a) => a.name),
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
          
          // Log para debugging
          const genreInfo = artistGenres.length > 0 ? ` [${artistGenres.slice(0, 2).join(', ')}${artistGenres.length > 2 ? '...' : ''}]` : '';
          if (bpm) {
            console.log(`     ✅ ${track.name}: ${Math.round(bpm)} BPM${genreInfo}${previewUrl ? ' + preview' : ''}`);
          } else {
            console.log(`     ⚠️  ${track.name}: Sin BPM${genreInfo}${previewUrl ? ' (tiene preview)' : ' (sin preview)'}`);
          }
        }

        console.log(`   ✅ ${tracks.length} tracks procesados para ${artistName}`);

        // Pequeña pausa para evitar rate limits
        await this.sleep(500);
      } catch (error) {
        console.error(`❌ Error procesando artista ${artistName}:`, error);
        // Continuar con el siguiente artista aunque falle uno
        continue;
      }
    }

    // 6. Upsert en Supabase
    if (allTracks.length > 0) {
      console.log(`\n💾 Guardando ${allTracks.length} tracks en Supabase...`);
      try {
        await this.supabase.upsertTracks(allTracks);
        console.log(`✅ ${allTracks.length} tracks guardados exitosamente`);
      } catch (error) {
        console.error('❌ Error guardando tracks en Supabase:', error);
        throw error;
      }
    } else {
      console.warn('⚠️  No hay tracks para guardar');
    }

    console.log('\n✅ Sincronización completada');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

