import { createClient } from '@supabase/supabase-js';
import { TrackData } from '../types';

export class SupabaseService {
  private client: ReturnType<typeof createClient>;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL y SUPABASE_SECRET_KEY o SUPABASE_ANON_KEY son requeridos');
    }

    this.client = createClient(url, key);
  }

  /**
   * Hace upsert de tracks en la base de datos
   */
  async upsertTracks(tracks: TrackData[]): Promise<void> {
    if (tracks.length === 0) {
      return;
    }

    try {
      // Eliminar duplicados por spotify_id antes de hacer upsert
      const uniqueTracks = Array.from(
        new Map(tracks.map(track => [track.spotify_id, track])).values()
      );

      const duplicatesRemoved = tracks.length - uniqueTracks.length;
      if (duplicatesRemoved > 0) {
        console.log(`   ⚠️  Se encontraron ${duplicatesRemoved} tracks duplicados en esta sincronización (mismo spotify_id)`);
      }

      console.log(`   💾 Procesando ${uniqueTracks.length} tracks únicos para guardar/actualizar en Supabase`);
      
      // Verificar que los géneros se están guardando
      const tracksWithGenres = uniqueTracks.filter(t => t.genres && t.genres.length > 0);
      if (tracksWithGenres.length > 0) {
        console.log(`   🎵 ${tracksWithGenres.length} tracks tienen géneros asignados`);
      }

      // Obtener count actual antes del upsert
      const { count: countBefore } = await this.client
        .from('artist_tracks')
        .select('*', { count: 'exact', head: true });

      // Hacer upsert en batches de 50 para evitar problemas
      const batchSize = 50;
      let savedCount = 0;
      for (let i = 0; i < uniqueTracks.length; i += batchSize) {
        const batch = uniqueTracks.slice(i, i + batchSize);
        const { error, data } = await this.client
          .from('artist_tracks')
          .upsert(
            batch.map((track) => ({
              spotify_id: track.spotify_id,
              name: track.name,
              artists: track.artists,
              artist_main: track.artist_main,
              album: track.album,
              release_date: track.release_date || null,
              duration_ms: track.duration_ms,
              bpm: track.bpm,
              genres: track.genres,
              preview_url: track.preview_url,
              cover_url: track.cover_url,
              fetched_at: new Date().toISOString(),
            })),
            {
              onConflict: 'spotify_id',
            }
          );

        if (error) {
          throw error;
        }
        
        savedCount += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tracks procesados (${savedCount}/${uniqueTracks.length})`);
      }

      // Obtener count después del upsert
      const { count: countAfter } = await this.client
        .from('artist_tracks')
        .select('*', { count: 'exact', head: true });

      console.log(`   📊 Total en Supabase: ${countBefore || 0} → ${countAfter || 0} tracks`);
      console.log(`   ✅ ${uniqueTracks.length} tracks procesados exitosamente (insertados nuevos o actualizados existentes)`);
    } catch (error) {
      console.error('Error haciendo upsert de tracks:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los tracks
   */
  async getAllTracks(): Promise<any[]> {
    try {
      // Primero obtener el count total
      const { count: totalCount } = await this.client
        .from('artist_tracks')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 Total tracks en DB según count: ${totalCount || 0}`);

      // Obtener todos los tracks, ordenando por fetched_at pero incluyendo NULLs
      // Usamos nullsFirst para que los tracks sin fetched_at también aparezcan
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*')
        .order('fetched_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false }); // Orden secundario por ID para consistencia

      if (error) {
        throw error;
      }

      const tracks = data || [];
      console.log(`📊 Tracks devueltos por query: ${tracks.length} (esperados: ${totalCount || 0})`);

      // Si hay diferencia, intentar obtener sin ordenamiento para debug
      if (totalCount && tracks.length < totalCount) {
        console.warn(`⚠️  Advertencia: Se esperaban ${totalCount} tracks pero se devolvieron ${tracks.length}`);
        // Intentar obtener todos sin ordenamiento
        const { data: allData, error: allError } = await this.client
          .from('artist_tracks')
          .select('*');

        if (!allError && allData) {
          console.log(`📊 Tracks sin ordenamiento: ${allData.length}`);
          // Ordenar manualmente
          return allData.sort((a: any, b: any) => {
            if (!a.fetched_at && !b.fetched_at) return 0;
            if (!a.fetched_at) return 1;
            if (!b.fetched_at) return -1;
            return new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
          });
        }
      }

      return tracks;
    } catch (error) {
      console.error('Error obteniendo tracks:', error);
      throw error;
    }
  }

  /**
   * Obtiene un track por ID
   */
  async getTrackById(id: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrado
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error obteniendo track ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene un track por spotify_id
   */
  async getTrackBySpotifyId(spotifyId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*')
        .eq('spotify_id', spotifyId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrado
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error obteniendo track por spotify_id ${spotifyId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene todos los artistas únicos que tienen tracks
   */
  async getAllArtists(): Promise<Array<{ name: string; id: string }>> {
    try {
      // Obtener artistas únicos con conteo de tracks
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('artist_main')
        .not('artist_main', 'is', null);

      if (error) {
        throw error;
      }

      // Contar tracks por artista y solo incluir artistas con tracks
      const artistCountMap = new Map<string, number>();

      (data || []).forEach((track: any) => {
        if (track.artist_main) {
          artistCountMap.set(
            track.artist_main,
            (artistCountMap.get(track.artist_main) || 0) + 1
          );
        }
      });

      // Filtrar solo artistas que tienen al menos 1 track
      const artists = Array.from(artistCountMap.entries())
        .filter(([, count]) => count > 0)
        .map(([name, count]) => ({ name, id: name, trackCount: count }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(`📊 Artistas encontrados con tracks: ${artists.length}`);
      if (artists.length > 0) {
        artists.forEach(artist => {
          console.log(`   - ${artist.name}: ${artist.trackCount} tracks`);
        });
      } else {
        console.log(`   ⚠️  No se encontraron artistas con tracks en la base de datos`);
      }

      // Validación adicional: asegurarse de que solo devolvemos artistas con tracks
      const validArtists = artists.filter(artist => artist.trackCount > 0);
      
      if (validArtists.length !== artists.length) {
        console.warn(`⚠️  Se filtraron ${artists.length - validArtists.length} artistas sin tracks`);
      }

      return validArtists.map(({ name, id }) => ({ name, id }));
    } catch (error) {
      console.error('Error obteniendo artistas:', error);
      throw error;
    }
  }

  /**
   * Obtiene tracks de un artista específico
   */
  async getTracksByArtist(artistName: string): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*')
        .eq('artist_main', artistName)
        .order('fetched_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error(`Error obteniendo tracks del artista ${artistName}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene métricas globales
   */
  async getGlobalMetrics(): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*');

      if (error) {
        throw error;
      }

      const tracks = data || [];

      // Calcular métricas
      const totalTracks = tracks.length;

      // BPM promedio
      const tracksWithBpm = tracks.filter((t: any) => t.bpm !== null);
      const bpmAverage =
        tracksWithBpm.length > 0
          ? tracksWithBpm.reduce((sum: number, t: any) => sum + parseFloat(t.bpm), 0) /
            tracksWithBpm.length
          : null;

      // Distribución de géneros
      const genreDistribution: Record<string, number> = {};
      tracks.forEach((track: any) => {
        if (track.genres && Array.isArray(track.genres)) {
          track.genres.forEach((genre: string) => {
            genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
          });
        }
      });

      // Tracks por artista
      const tracksByArtist: Record<string, number> = {};
      tracks.forEach((track: any) => {
        if (track.artist_main) {
          tracksByArtist[track.artist_main] = (tracksByArtist[track.artist_main] || 0) + 1;
        }
      });

      // BPM promedio por artista
      const avgBpmByArtist: Record<string, number> = {};
      Object.keys(tracksByArtist).forEach((artist) => {
        const artistTracks = tracks.filter((t: any) => t.artist_main === artist);
        const artistTracksWithBpm = artistTracks.filter((t: any) => t.bpm !== null);
        if (artistTracksWithBpm.length > 0) {
          avgBpmByArtist[artist] =
            artistTracksWithBpm.reduce((sum: number, t: any) => sum + parseFloat(t.bpm), 0) /
            artistTracksWithBpm.length;
        }
      });

      return {
        total_tracks: totalTracks,
        bpm_average: bpmAverage,
        genre_distribution: genreDistribution,
        tracks_by_artist: tracksByArtist,
        avg_bpm_by_artist: avgBpmByArtist,
      };
    } catch (error) {
      console.error('Error obteniendo métricas globales:', error);
      throw error;
    }
  }

  /**
   * Obtiene métricas de un artista específico
   */
  async getArtistMetrics(artistName: string): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*')
        .eq('artist_main', artistName);

      if (error) {
        throw error;
      }

      const tracks = data || [];

      // Total tracks
      const totalTracks = tracks.length;

      // BPM promedio
      const tracksWithBpm = tracks.filter((t: any) => t.bpm !== null);
      const bpmPromedio =
        tracksWithBpm.length > 0
          ? tracksWithBpm.reduce((sum: number, t: any) => sum + parseFloat(t.bpm), 0) /
            tracksWithBpm.length
          : null;

      // Géneros predominantes
      const genreCount: Record<string, number> = {};
      tracks.forEach((track: any) => {
        if (track.genres && Array.isArray(track.genres)) {
          track.genres.forEach((genre: string) => {
            genreCount[genre] = (genreCount[genre] || 0) + 1;
          });
        }
      });

      const generosPredominantes = Object.entries(genreCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([genre]) => genre);

      // Distribuciones de release_date
      const distribucionesReleaseDate: Record<string, number> = {};
      tracks.forEach((track: any) => {
        if (track.release_date) {
          const year = track.release_date.substring(0, 4);
          distribucionesReleaseDate[year] = (distribucionesReleaseDate[year] || 0) + 1;
        }
      });

      return {
        total_tracks: totalTracks,
        bpm_promedio: bpmPromedio,
        generos_predominantes: generosPredominantes,
        distribuciones_release_date: distribucionesReleaseDate,
      };
    } catch (error) {
      console.error(`Error obteniendo métricas del artista ${artistName}:`, error);
      throw error;
    }
  }
}

