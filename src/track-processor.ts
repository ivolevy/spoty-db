import { SpotifyClient } from './spotify-client';
import { SpotifyTrack, SpotifyAudioFeatures, SpotifyArtist, TrackData } from './types';
import { normalizeLabel, matchesLabel } from './label-matcher';
import { config } from './config';

/**
 * Procesa tracks de Spotify y los convierte al formato de la base de datos
 */
export class TrackProcessor {
  private spotifyClient: SpotifyClient;
  private audioFeaturesCache: Map<string, SpotifyAudioFeatures> = new Map();
  private artistCache: Map<string, SpotifyArtist> = new Map();

  constructor(spotifyClient: SpotifyClient) {
    this.spotifyClient = spotifyClient;
  }

  /**
   * Procesa un track y retorna los datos en el formato esperado
   */
  async processTrack(track: SpotifyTrack): Promise<TrackData | null> {
    try {
      // Verificar que el label coincida
      const label = track.album.label;
      if (!matchesLabel(label, config.crawler.labelSearchTerm)) {
        // Log solo cada 10 tracks para no saturar
        if (Math.random() < 0.1) {
          console.log(`   ⏭️  Track "${track.name}" no coincide con label (label: ${label || 'sin label'})`);
        }
        return null;
      }
      
      console.log(`   ✓ Track "${track.name}" coincide con label: ${label}`);

      // Obtener audio features (BPM)
      let audioFeatures: SpotifyAudioFeatures | null = null;
      try {
        if (!this.audioFeaturesCache.has(track.id)) {
          audioFeatures = await this.spotifyClient.getAudioFeatures(track.id);
          this.audioFeaturesCache.set(track.id, audioFeatures);
        } else {
          audioFeatures = this.audioFeaturesCache.get(track.id)!;
        }
      } catch (error) {
        console.warn(`No se pudieron obtener audio features para ${track.id}:`, error);
      }

      // Obtener géneros del primer artista
      let genre: string | null = null;
      if (track.artists.length > 0) {
        try {
          const artistId = track.artists[0].id;
          if (!this.artistCache.has(artistId)) {
            const artist = await this.spotifyClient.getArtist(artistId);
            this.artistCache.set(artistId, artist);
          }
          const artist = this.artistCache.get(artistId)!;
          
          // Usar el primer género del artista si existe
          if (artist.genres && artist.genres.length > 0) {
            genre = artist.genres[0];
          }
        } catch (error) {
          console.warn(`No se pudo obtener género para artista ${track.artists[0].id}:`, error);
        }
      }

      // Extraer información del track
      const trackData: TrackData = {
        spotify_id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        album: track.album.name,
        label: label || '',
        label_normalized: normalizeLabel(label),
        release_date: track.album.release_date || '',
        duration_ms: track.duration_ms,
        genre: genre,
        bpm: audioFeatures?.tempo || null,
        preview_url: track.preview_url,
        cover_url: track.album.images[0]?.url || null,
      };

      return trackData;
    } catch (error) {
      console.error(`Error procesando track ${track.id}:`, error);
      return null;
    }
  }

  /**
   * Procesa múltiples tracks en batch
   */
  async processTracks(tracks: SpotifyTrack[]): Promise<TrackData[]> {
    const results: TrackData[] = [];
    const batchSize = 5; // Procesar en batches más pequeños para evitar rate limits

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      
      for (const track of batch) {
        const processed = await this.processTrack(track);
        if (processed) {
          results.push(processed);
        }
      }
      
      // Pequeña pausa entre batches para evitar rate limits
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Limpia las cachés para liberar memoria
   */
  clearCache(): void {
    this.audioFeaturesCache.clear();
    this.artistCache.clear();
  }
}

