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
    console.log('🔗 Conectando a Supabase...');
    
    return new Promise((resolve) => {
      // Timeout de 5 segundos - si tarda más, continuar sin deduplicación
      const timeout = setTimeout(() => {
        console.log('⏱️  Timeout: Continuando sin cargar IDs existentes (tabla vacía o conexión lenta)');
        resolve(new Set());
      }, 5000);

      this.client
        .from('label_tracks')
        .select('spotify_id')
        .limit(10000)
        .then(({ data, error }) => {
          clearTimeout(timeout);
          
          if (error) {
            console.error('❌ Error de Supabase:', error.message);
            console.log('⚠️  Continuando sin deduplicación previa...');
            resolve(new Set());
            return;
          }

          const ids = (data || []).map((row: any) => row.spotify_id);
          console.log(`✅ Recibidos ${ids.length} IDs de Supabase`);
          resolve(new Set(ids));
        })
        .catch((error: any) => {
          clearTimeout(timeout);
          console.error('❌ Error en consulta:', error.message);
          console.log('⚠️  Continuando sin deduplicación previa...');
          resolve(new Set());
        });
    });
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

