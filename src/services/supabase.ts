import { createClient } from '@supabase/supabase-js';
import { TrackData } from '../types';

/**
 * Normaliza una fecha de Spotify a formato PostgreSQL (YYYY-MM-DD)
 * Spotify puede devolver:
 * - Solo año: "2004" -> "2004-01-01"
 * - Año-mes: "2004-01" -> "2004-01-01"
 * - Fecha completa: "2004-01-01" -> "2004-01-01"
 */
function normalizeReleaseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  // Si es solo año (4 dígitos)
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }
  
  // Si es año-mes (YYYY-MM)
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }
  
  // Si ya es una fecha completa (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Si no coincide con ningún formato válido, retornar null
  console.warn(`⚠️  Formato de fecha no reconocido: "${trimmed}", se guardará como null`);
  return null;
}

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
      console.warn('⚠️  upsertTracks llamado con array vacío');
      return;
    }

    try {
      // Eliminar duplicados por spotify_id antes de hacer upsert
      // Esto previene duplicados dentro del mismo batch
      const uniqueTracks = Array.from(
        new Map(tracks.map(track => [track.spotify_id, track])).values()
      );

      console.log(`   📊 Preparando ${uniqueTracks.length} tracks únicos (de ${tracks.length} totales) para guardar`);
      
      // Verificar si hay duplicados en la base de datos antes de guardar
      // Esto es una optimización: el upsert ya maneja duplicados, pero esto evita peticiones innecesarias
      const spotifyIds = uniqueTracks.map(t => t.spotify_id);
      let tracksToSave = uniqueTracks;
      
      try {
        const { data: existingTracks, error: checkError } = await this.client
          .from('artist_tracks')
          .select('spotify_id')
          .in('spotify_id', spotifyIds);
        
        if (checkError) {
          console.warn(`   ⚠️  Error verificando duplicados: ${checkError.message}`);
          console.warn(`   Continuando con upsert (el upsert maneja duplicados automáticamente)`);
        } else if (existingTracks && existingTracks.length > 0) {
          const existingIds = new Set(existingTracks.map((t: any) => t.spotify_id));
          const newTracks = uniqueTracks.filter(t => !existingIds.has(t.spotify_id));
          console.log(`   🔍 Encontrados ${existingTracks.length} tracks existentes en la BD`);
          console.log(`   📦 ${newTracks.length} tracks nuevos para guardar`);
          
          if (newTracks.length === 0) {
            console.log(`   ✅ Todos los tracks ya existen en la base de datos. No hay nada nuevo que guardar.`);
            return;
          }
          
          tracksToSave = newTracks;
        } else {
          console.log(`   📦 Todos los tracks son nuevos (${uniqueTracks.length} tracks)`);
        }
      } catch (error: any) {
        console.warn(`   ⚠️  Error verificando duplicados: ${error.message}`);
        console.warn(`   Continuando con upsert (el upsert maneja duplicados con onConflict)`);
      }

      // Hacer upsert en batches de 50 para evitar problemas
      // El upsert con onConflict: 'spotify_id' previene duplicados automáticamente
      const batchSize = 50;
      let savedCount = 0;
      
      for (let i = 0; i < tracksToSave.length; i += batchSize) {
        const batch = tracksToSave.slice(i, i + batchSize);
        console.log(`   💾 Guardando batch ${Math.floor(i / batchSize) + 1} (${batch.length} tracks)...`);
        
        const upsertData = batch.map((track) => ({
          spotify_id: track.spotify_id,
          name: track.name,
          artists: track.artists,
          artist_main: track.artist_main,
          album: track.album,
          release_date: normalizeReleaseDate(track.release_date),
          duration_ms: track.duration_ms,
          bpm: track.bpm,
          genres: track.genres,
          preview_url: track.preview_url,
          cover_url: track.cover_url,
          fetched_at: new Date().toISOString(),
        }));

        // @ts-expect-error - Supabase type inference issue with upsert
        const { data, error } = await this.client
          .from('artist_tracks')
          .upsert(upsertData, {
            onConflict: 'spotify_id',
          });

        if (error) {
          console.error(`   ❌ Error en batch ${Math.floor(i / batchSize) + 1}:`, error);
          console.error(`   Error details:`, JSON.stringify(error, null, 2));
          throw error;
        }
        
        savedCount += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1} guardado exitosamente (${savedCount}/${tracksToSave.length})`);
      }
      
      console.log(`   ✅ Total: ${savedCount} tracks guardados en Supabase`);
      console.log(`   🔒 Protección contra duplicados: onConflict en 'spotify_id' asegura que no se guarden duplicados`);
    } catch (error: any) {
      console.error('❌ Error haciendo upsert de tracks:');
      console.error('   Error message:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error details:', JSON.stringify(error, null, 2));
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

      // Top artists con duración total
      const topArtists = Object.entries(tracksByArtist)
        .map(([artist, count]) => {
          const artistTracks = tracks.filter((t: any) => t.artist_main === artist);
          const totalDuration = artistTracks.reduce((sum: number, t: any) => sum + (t.duration_ms || 0), 0);
          const durationMinutes = Math.floor(totalDuration / 60000);
          const durationHours = Math.floor(durationMinutes / 60);
          const remainingMinutes = durationMinutes % 60;
          const durationFormatted = durationHours > 0 
            ? `${durationHours}h ${remainingMinutes}m` 
            : `${remainingMinutes}m`;
          
          return {
            name: artist,
            trackCount: count as number,
            totalDuration: totalDuration,
            durationFormatted: durationFormatted,
            avgBpm: avgBpmByArtist[artist] || null,
          };
        })
        .sort((a, b) => b.trackCount - a.trackCount)
        .slice(0, 20);

      // Top albums
      const albumsByCount: Record<string, { count: number; artist: string; cover?: string }> = {};
      tracks.forEach((track: any) => {
        if (track.album) {
          const key = `${track.album}|${track.artist_main || ''}`;
          if (!albumsByCount[key]) {
            albumsByCount[key] = {
              count: 0,
              artist: track.artist_main || '',
              cover: track.cover_url || null,
            };
          }
          albumsByCount[key].count++;
        }
      });

      const topAlbums = Object.entries(albumsByCount)
        .map(([key, data]) => {
          const [albumName] = key.split('|');
          return {
            name: albumName,
            artist: data.artist,
            trackCount: data.count,
            cover: data.cover,
          };
        })
        .sort((a, b) => b.trackCount - a.trackCount)
        .slice(0, 20);

      // Duración total
      const totalDuration = tracks.reduce((sum: number, t: any) => sum + (t.duration_ms || 0), 0);
      const totalDurationMinutes = Math.floor(totalDuration / 60000);
      const totalDurationHours = Math.floor(totalDurationMinutes / 60);
      const totalDurationRemainingMinutes = totalDurationMinutes % 60;
      const totalDurationFormatted = totalDurationHours > 0 
        ? `${totalDurationHours}h ${totalDurationRemainingMinutes}m` 
        : `${totalDurationRemainingMinutes}m`;

      return {
        total_tracks: totalTracks,
        bpm_average: bpmAverage,
        genre_distribution: genreDistribution,
        tracks_by_artist: tracksByArtist,
        avg_bpm_by_artist: avgBpmByArtist,
        top_artists: topArtists,
        top_albums: topAlbums,
        total_duration: totalDuration,
        total_duration_formatted: totalDurationFormatted,
        unique_artists: Object.keys(tracksByArtist).length,
        unique_albums: Object.keys(albumsByCount).length,
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

