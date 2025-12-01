import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  SpotifyArtist,
  SpotifyTrack,
  SpotifyAudioFeatures,
} from '../types';

export class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private axiosInstance: AxiosInstance;

  constructor() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET son requeridos');
    }

    this.axiosInstance = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 20000, // Aumentado a 20 segundos
    });
  }

  /**
   * Obtiene un token de acceso usando Client Credentials Flow
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID!;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
    const maxRetries = 3;
    let lastError: any;

    // Validar credenciales antes de intentar
    if (!clientId || !clientSecret) {
      throw new Error('SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET son requeridos');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        console.log(`[${new Date().toISOString()}] Intentando obtener token de Spotify (intento ${attempt}/${maxRetries})...`);
        
        // Crear un timeout manual más agresivo
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
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
                  `${clientId}:${clientSecret}`
                ).toString('base64')}`,
              },
              timeout: 8000,
              validateStatus: (status) => status < 500,
              signal: controller.signal,
            }
          );
          
          clearTimeout(timeoutId);
          
          const elapsed = Date.now() - startTime;
          console.log(`[${new Date().toISOString()}] Respuesta recibida en ${elapsed}ms (status: ${response.status})`);

          if (response.status !== 200) {
            throw new Error(`Spotify API returned status ${response.status}: ${JSON.stringify(response.data)}`);
          }

          this.accessToken = response.data.access_token;
          this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

          if (!this.accessToken) {
            throw new Error('No se recibió token de acceso de Spotify');
          }

          console.log(`✅ Token de Spotify obtenido exitosamente (intento ${attempt})`);
          return this.accessToken;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
            throw new Error('Request timeout after 8s');
          }
          throw err;
        }

        const elapsed = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Respuesta recibida en ${elapsed}ms (status: ${response.status})`);

        if (response.status !== 200) {
          throw new Error(`Spotify API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        this.accessToken = response.data.access_token;
        this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

        if (!this.accessToken) {
          throw new Error('No se recibió token de acceso de Spotify');
        }

        console.log(`✅ Token de Spotify obtenido exitosamente (intento ${attempt})`);
        return this.accessToken;
      } catch (error: any) {
        lastError = error;
        const isTimeout = error.code === 'ECONNABORTED' || 
                         error.message?.includes('timeout') ||
                         error.message?.includes('ETIMEDOUT');
        
        console.error(`[${new Date().toISOString()}] Error en intento ${attempt}:`, {
          code: error.code,
          message: error.message,
          status: error.response?.status,
          isTimeout
        });
        
        if (isTimeout && attempt < maxRetries) {
          const waitTime = attempt * 1000; // Esperar 1s, 2s, 3s
          console.warn(`⏳ Timeout obteniendo token. Esperando ${waitTime}ms antes de reintentar...`);
          await this.sleep(waitTime);
          continue;
        }
        
        // Si no es timeout o es el último intento, lanzar error
        if (attempt === maxRetries) {
          const errorMsg = isTimeout 
            ? `Timeout después de ${maxRetries} intentos`
            : `Error después de ${maxRetries} intentos: ${error.response?.data?.error_description || error.message || error.code || 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }
    }

    throw new Error('No se pudo obtener el token de acceso de Spotify');
  }

  /**
   * Realiza una petición con manejo automático de rate limits y reintentos
   */
  private async makeRequest<T>(
    method: 'get' | 'post',
    url: string,
    params?: Record<string, any>
  ): Promise<T> {
    const token = await this.getAccessToken();
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        const response = await this.axiosInstance.request<T>({
          method,
          url,
          params,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        return response.data;
      } catch (error) {
        const axiosError = error as AxiosError;

        // Rate limit (429)
        if (axiosError.response?.status === 429) {
          const retryAfter = parseInt(
            axiosError.response.headers['retry-after'] || '1000',
            10
          );

          console.warn(
            `Rate limit alcanzado. Esperando ${retryAfter}ms antes de reintentar... (intento ${retries + 1}/${maxRetries})`
          );

          await this.sleep(retryAfter);
          retries++;
          continue;
        }

        // Token expirado o inválido (401)
        if (axiosError.response?.status === 401) {
          console.warn('Token expirado, obteniendo nuevo token...');
          this.accessToken = null;
          retries++;
          continue;
        }

        // Timeout
        if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
          console.error(`Timeout en petición a ${url}. Reintentando...`);
          retries++;
          if (retries < maxRetries) {
            await this.sleep(1000);
            continue;
          }
          throw new Error(`Timeout después de ${retries} intentos`);
        }

        // Otros errores
        throw error;
      }
    }

    throw new Error(`No se pudo completar la petición después de ${maxRetries} intentos`);
  }

  /**
   * Busca un artista por nombre y retorna el más popular
   */
  async searchArtist(name: string): Promise<SpotifyArtist | null> {
    try {
      const response = await this.makeRequest<{
        artists: {
          items: Array<{
            id: string;
            name: string;
            popularity: number;
            genres: string[];
          }>;
        };
      }>('get', '/search', {
        q: name,
        type: 'artist',
        limit: 10,
      });

      if (response.artists.items.length === 0) {
        return null;
      }

      // Elegir el resultado con mayor popularity
      const sortedArtists = response.artists.items.sort(
        (a, b) => b.popularity - a.popularity
      );

      const topArtist = sortedArtists[0];

      return {
        id: topArtist.id,
        name: topArtist.name,
        popularity: topArtist.popularity,
        genres: topArtist.genres,
      };
    } catch (error) {
      console.error(`Error buscando artista "${name}":`, error);
      throw error;
    }
  }

  /**
   * Obtiene los top tracks de un artista
   */
  async getArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
    try {
      const response = await this.makeRequest<{
        tracks: Array<{
          id: string;
          name: string;
          artists: Array<{
            id: string;
            name: string;
          }>;
          album: {
            id: string;
            name: string;
            release_date: string;
            images: Array<{
              url: string;
            }>;
          };
          duration_ms: number;
          preview_url: string | null;
        }>;
      }>('get', `/artists/${artistId}/top-tracks`, {
        market: 'US',
      });

      // Tomar solo los primeros 5 tracks
      return response.tracks.slice(0, 5).map((track) => ({
        id: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
      }));
    } catch (error) {
      console.error(`Error obteniendo top tracks del artista ${artistId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene audio features (BPM) de múltiples tracks
   */
  async getAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
    if (trackIds.length === 0) {
      return [];
    }

    // Spotify permite hasta 100 IDs por request
    const chunks: string[][] = [];
    for (let i = 0; i < trackIds.length; i += 100) {
      chunks.push(trackIds.slice(i, i + 100));
    }

    const results: SpotifyAudioFeatures[] = [];

    for (const chunk of chunks) {
      try {
        const response = await this.makeRequest<{
          audio_features: Array<{
            id: string;
            tempo: number;
            duration_ms: number;
          } | null>;
        }>('get', '/audio-features', {
          ids: chunk.join(','),
        });

        const features = response.audio_features
          .filter((f): f is NonNullable<typeof f> => f !== null)
          .map((f) => ({
            id: f.id,
            tempo: f.tempo,
            duration_ms: f.duration_ms,
          }));

        results.push(...features);
      } catch (error) {
        console.error(`Error obteniendo audio features:`, error);
        // Continuar con los siguientes chunks aunque falle uno
      }
    }

    return results;
  }

  /**
   * Obtiene información completa de un artista (incluye géneros)
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    try {
      const response = await this.makeRequest<{
        id: string;
        name: string;
        popularity: number;
        genres: string[];
      }>('get', `/artists/${artistId}`);

      return {
        id: response.id,
        name: response.name,
        popularity: response.popularity,
        genres: response.genres,
      };
    } catch (error) {
      console.error(`Error obteniendo información del artista ${artistId}:`, error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

