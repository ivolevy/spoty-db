import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from './config';
import { SpotifyTrack, SpotifyAudioFeatures, SpotifyArtist, SearchResult } from './types';

/**
 * Cliente para interactuar con la API de Spotify
 * Maneja autenticación OAuth, rate limits y reintentos automáticos
 */
export class SpotifyClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Obtiene un token de acceso usando Client Credentials Flow
   */
  private async getAccessToken(): Promise<string> {
    // Si el token aún es válido, lo reutilizamos
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${config.spotify.clientId}:${config.spotify.clientSecret}`
            ).toString('base64')}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Expira 5 minutos antes para evitar problemas de timing
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

      if (!this.accessToken) {
        throw new Error('No se recibió token de acceso de Spotify');
      }

      return this.accessToken;
    } catch (error) {
      console.error('Error obteniendo token de Spotify:', error);
      throw new Error('No se pudo obtener el token de acceso de Spotify');
    }
  }

  /**
   * Realiza una petición con manejo automático de rate limits
   */
  private async makeRequest<T>(
    method: 'get' | 'post',
    url: string,
    params?: Record<string, any>
  ): Promise<T> {
    const token = await this.getAccessToken();
    let retries = 0;

    while (retries < config.spotify.rateLimitRetries) {
      try {
        const response = await this.axiosInstance.request<T>({
          method,
          url,
          params,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Resetear token si expiró (por si acaso)
        if (this.accessToken && Date.now() >= this.tokenExpiresAt) {
          this.accessToken = null;
        }

        return response.data;
      } catch (error) {
        const axiosError = error as AxiosError;

        // Rate limit (429)
        if (axiosError.response?.status === 429) {
          const retryAfter = parseInt(
            axiosError.response.headers['retry-after'] || 
            String(config.spotify.rateLimitDelay),
            10
          );
          
          console.warn(
            `Rate limit alcanzado. Esperando ${retryAfter}ms antes de reintentar... (intento ${retries + 1}/${config.spotify.rateLimitRetries})`
          );
          
          await this.sleep(retryAfter);
          retries++;
          continue;
        }

        // Token expirado o inválido
        if (axiosError.response?.status === 401) {
          console.warn('Token expirado, obteniendo nuevo token...');
          this.accessToken = null;
          continue;
        }

        // Otros errores
        throw error;
      }
    }

    throw new Error(`No se pudo completar la petición después de ${config.spotify.rateLimitRetries} intentos`);
  }

  /**
   * Busca tracks en Spotify
   */
  async searchTracks(query: string, limit: number = 50, offset: number = 0): Promise<SearchResult> {
    console.log(`   🔍 Request a Spotify API: query="${query}", limit=${limit}, offset=${offset}`);
    const result = await this.makeRequest<SearchResult>('get', '/search', {
      q: query,
      type: 'track',
      limit,
      offset,
      market: 'US', // Market para obtener preview_url
    });
    console.log(`   ✅ Spotify API respondió: ${result.tracks.items.length} tracks encontrados (total: ${result.tracks.total})`);
    return result;
  }

  /**
   * Obtiene información detallada de un track
   */
  async getTrack(trackId: string): Promise<SpotifyTrack> {
    return this.makeRequest<SpotifyTrack>('get', `/tracks/${trackId}`);
  }

  /**
   * Obtiene audio features de un track (incluye BPM)
   */
  async getAudioFeatures(trackId: string): Promise<SpotifyAudioFeatures> {
    return this.makeRequest<SpotifyAudioFeatures>('get', `/audio-features/${trackId}`);
  }

  /**
   * Obtiene información de un artista (incluye géneros)
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    return this.makeRequest<SpotifyArtist>('get', `/artists/${artistId}`);
  }

  /**
   * Obtiene audio features de múltiples tracks
   */
  async getMultipleAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
    // Spotify permite hasta 100 IDs por request
    const chunks: string[][] = [];
    for (let i = 0; i < trackIds.length; i += 100) {
      chunks.push(trackIds.slice(i, i + 100));
    }

    const results: SpotifyAudioFeatures[] = [];
    for (const chunk of chunks) {
      const response = await this.makeRequest<{ audio_features: SpotifyAudioFeatures[] }>(
        'get',
        '/audio-features',
        { ids: chunk.join(',') }
      );
      results.push(...response.audio_features.filter(f => f !== null));
    }

    return results;
  }

  /**
   * Utilidad para pausar la ejecución
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

