import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  SpotifyArtist,
  SpotifyTrack,
  SpotifyAudioFeatures,
} from '../types';

export class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private userAccessToken: string | null = null; // Token de usuario para obtener BPM
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
      timeout: 30000, // 30 segundos para peticiones a Spotify
    });

    // Si hay un token de usuario en las variables de entorno, usarlo
    if (process.env.SPOTIFY_USER_TOKEN) {
      this.userAccessToken = process.env.SPOTIFY_USER_TOKEN;
      console.log('✅ Token de usuario cargado desde variables de entorno');
    }
  }

  /**
   * Establece un token de acceso de usuario (para obtener BPM)
   */
  setUserToken(token: string) {
    this.userAccessToken = token;
  }

  /**
   * Obtiene el token de usuario si está disponible
   */
  getUserToken(): string | null {
    return this.userAccessToken;
  }

  /**
   * Obtiene un token de acceso usando Client Credentials Flow
   * Si hay un token de usuario disponible, lo usa para endpoints que lo requieren
   */
  private async getAccessToken(useUserToken: boolean = false): Promise<string> {
    // Si se solicita usar token de usuario y está disponible, usarlo
    if (useUserToken && this.userAccessToken) {
      console.log(`🔑 Usando token de usuario para esta petición (primeros 20 chars: ${this.userAccessToken.substring(0, 20)}...)`);
      return this.userAccessToken;
    }

    // Si hay token válido de Client Credentials, usarlo
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
        
        // Usar fetch nativo con timeout más agresivo
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`[${new Date().toISOString()}] Timeout alcanzado, abortando request...`);
          controller.abort();
        }, 5000); // 5 segundos máximo
        
        try {
          const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          
          const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${authString}`,
            },
            body: 'grant_type=client_credentials',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          const elapsed = Date.now() - startTime;
          console.log(`[${new Date().toISOString()}] Respuesta recibida en ${elapsed}ms (status: ${response.status})`);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Spotify API returned status ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          this.accessToken = data.access_token;
          this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

          if (!this.accessToken) {
            throw new Error('No se recibió token de acceso de Spotify');
          }

          console.log(`✅ Token de Spotify obtenido exitosamente (intento ${attempt})`);
          return this.accessToken;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            throw new Error('Request timeout after 5s');
          }
          throw err;
        }
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
   * Puede ser llamado desde fuera de la clase para búsquedas personalizadas
   */
  async makeRequest<T>(
    method: 'get' | 'post',
    url: string,
    params?: Record<string, any>,
    useUserToken: boolean = false
  ): Promise<T> {
    const token = await this.getAccessToken(useUserToken);
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

        // Forbidden (403) - puede ser por permisos o porque el recurso no está disponible
        if (axiosError.response?.status === 403) {
          const errorData = axiosError.response.data as any;
          const errorMsg = errorData?.error?.message || 'Forbidden';
          console.warn(`⚠️  403 Forbidden en ${url}: ${errorMsg}`);
          // No reintentar para 403, lanzar error directamente
          throw new Error(`403 Forbidden: ${errorMsg}`);
        }

        // Not Found (404) - recurso no existe
        if (axiosError.response?.status === 404) {
          throw new Error(`404 Not Found: El recurso no existe`);
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

      // Buscar coincidencia exacta primero, luego por popularidad
      const exactMatch = response.artists.items.find(
        (artist) => artist.name.toLowerCase() === name.toLowerCase()
      );
      
      if (exactMatch) {
        return {
          id: exactMatch.id,
          name: exactMatch.name,
          popularity: exactMatch.popularity,
          genres: exactMatch.genres,
        };
      }

      // Si no hay coincidencia exacta, elegir el más popular
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
        market: 'AR', // Argentina - mercado principal para Dale Play Records
      });

      // Retornar todos los tracks (el límite se maneja en el código que llama)
      return response.tracks.map((track) => ({
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

    const results: SpotifyAudioFeatures[] = [];

    // Intentar primero con batch (más eficiente)
    try {
      // Spotify permite hasta 100 IDs por request
      const chunks: string[][] = [];
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100));
      }

      for (const chunk of chunks) {
        try {
          // Intentar con token de usuario si está disponible (necesario para audio-features)
          const response = await this.makeRequest<{
            audio_features: Array<{
              id: string;
              tempo: number;
              duration_ms: number;
            } | null>;
          }>('get', '/audio-features', {
            ids: chunk.join(','),
          }, true); // useUserToken = true para audio-features

          const features = response.audio_features
            .filter((f): f is NonNullable<typeof f> => f !== null)
            .map((f) => ({
              id: f.id,
              tempo: f.tempo,
              duration_ms: f.duration_ms,
            }));

          results.push(...features);
        } catch (error: any) {
          // Si falla el batch, intentar individualmente para este chunk
          console.warn(`   ⚠️  Error en batch de audio-features, intentando individualmente...`);
          for (const trackId of chunk) {
            try {
              const individualResponse = await this.makeRequest<{
                id: string;
                tempo: number;
                duration_ms: number;
              }>('get', `/audio-features/${trackId}`, undefined, true); // useUserToken = true
              
              if (individualResponse && individualResponse.tempo) {
                results.push({
                  id: individualResponse.id,
                  tempo: individualResponse.tempo,
                  duration_ms: individualResponse.duration_ms,
                });
              }
              // Pequeña pausa para evitar rate limits
              await this.sleep(100);
        } catch (err: any) {
          // Si falla individual, mostrar más detalles del error
          const errorMsg = err.response?.status === 403 
            ? '403 Forbidden (puede requerir permisos especiales o el track no tiene audio features)'
            : err.response?.status === 404
            ? '404 Not Found (track no tiene audio features disponibles)'
            : err.message || 'Error desconocido';
          console.warn(`     ⚠️  No se pudo obtener BPM para track ${trackId}: ${errorMsg}`);
        }
          }
        }
      }
    } catch (error: any) {
      console.warn(`   ⚠️  Error general obteniendo audio features:`, error.message);
      // Si todo falla, intentar individualmente
      for (const trackId of trackIds) {
        try {
          const response = await this.makeRequest<{
            id: string;
            tempo: number;
            duration_ms: number;
          }>('get', `/audio-features/${trackId}`, undefined, true); // useUserToken = true
          
          if (response && response.tempo) {
            results.push({
              id: response.id,
              tempo: response.tempo,
              duration_ms: response.duration_ms,
            });
          }
          await this.sleep(100);
        } catch (err) {
          // Continuar sin BPM para ese track
        }
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

