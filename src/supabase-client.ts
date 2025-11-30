import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { TrackData } from './types';

/**
 * Cliente para interactuar con Supabase
 */
export class SupabaseClientWrapper {
  private client: SupabaseClient;

  constructor() {
    if (!config.supabase.url || !config.supabase.key) {
      throw new Error('Supabase URL y Key son requeridos');
    }

    this.client = createClient(config.supabase.url, config.supabase.key);
  }

  /**
   * Inserta o actualiza un track en la base de datos
   * Usa upsert para evitar duplicados basado en spotify_id
   */
  async upsertTrack(track: TrackData): Promise<void> {
    const { error } = await this.client
      .from('label_tracks')
      .upsert(
        {
          spotify_id: track.spotify_id,
          name: track.name,
          artists: track.artists,
          album: track.album,
          label: track.label,
          label_normalized: track.label_normalized,
          release_date: track.release_date,
          duration_ms: track.duration_ms,
          genre: track.genre,
          bpm: track.bpm,
          preview_url: track.preview_url,
          cover_url: track.cover_url,
        },
        {
          onConflict: 'spotify_id',
          ignoreDuplicates: false, // Actualizar si existe
        }
      );

    if (error) {
      throw new Error(`Error insertando track ${track.spotify_id}: ${error.message}`);
    }
  }

  /**
   * Inserta múltiples tracks en batch
   */
  async upsertTracks(tracks: TrackData[]): Promise<void> {
    if (tracks.length === 0) return;

    const { error } = await this.client
      .from('label_tracks')
      .upsert(
        tracks.map(track => ({
          spotify_id: track.spotify_id,
          name: track.name,
          artists: track.artists,
          album: track.album,
          label: track.label,
          label_normalized: track.label_normalized,
          release_date: track.release_date,
          duration_ms: track.duration_ms,
          genre: track.genre,
          bpm: track.bpm,
          preview_url: track.preview_url,
          cover_url: track.cover_url,
        })),
        {
          onConflict: 'spotify_id',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      throw new Error(`Error insertando tracks: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los spotify_id existentes en la base de datos
   * Útil para deduplicación antes de insertar
   */
  async getExistingSpotifyIds(): Promise<Set<string>> {
    try {
      console.log('🔗 Conectando a Supabase...');
      const { data, error } = await this.client
        .from('label_tracks')
        .select('spotify_id')
        .limit(10000); // Limitar para evitar timeouts con tablas muy grandes

      if (error) {
        console.error('❌ Error de Supabase:', error);
        throw new Error(`Error obteniendo IDs existentes: ${error.message}`);
      }

      console.log(`📊 Recibidos ${data?.length || 0} IDs de Supabase`);
      return new Set((data || []).map(row => row.spotify_id));
    } catch (error: any) {
      console.error('❌ Error completo en getExistingSpotifyIds:', error);
      throw error;
    }
  }

  /**
   * Obtiene el número total de tracks en la base de datos
   */
  async getTrackCount(): Promise<number> {
    const { count, error } = await this.client
      .from('label_tracks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Error obteniendo conteo: ${error.message}`);
    }

    return count || 0;
  }
}

