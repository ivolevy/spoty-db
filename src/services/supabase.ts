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
      const { error } = await this.client
        .from('artist_tracks')
        .upsert(
          tracks.map((track) => ({
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
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('*')
        .order('fetched_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
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
   * Obtiene todos los artistas únicos
   */
  async getAllArtists(): Promise<Array<{ name: string; id: string }>> {
    try {
      const { data, error } = await this.client
        .from('artist_tracks')
        .select('artist_main, artists')
        .order('artist_main');

      if (error) {
        throw error;
      }

      // Obtener artistas únicos
      const artistMap = new Map<string, string>();

      (data || []).forEach((track: any) => {
        if (track.artist_main && !artistMap.has(track.artist_main)) {
          // Buscar el ID del artista principal en el array de artists
          // Por ahora usamos el nombre como ID, ya que no tenemos el spotify_id del artista guardado
          artistMap.set(track.artist_main, track.artist_main);
        }
      });

      return Array.from(artistMap.entries()).map(([name, id]) => ({ name, id }));
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

