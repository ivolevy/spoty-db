/**
 * Versión mejorada del crawler que permite buscar por artistas conocidos
 * Úsalo si conoces artistas específicos del sello "Dale Play Records"
 * 
 * Para usar:
 * 1. Agrega los nombres de artistas en el array ARTISTS_KNOWN
 * 2. Ejecuta: npm run dev -- --enhanced
 */

import { SpotifyClient } from './spotify-client';
import { SupabaseClientWrapper } from './supabase-client';
import { TrackProcessor } from './track-processor';
import { config } from './config';
import { SpotifyTrack } from './types';

/**
 * Lista de artistas conocidos del sello "Dale Play Records"
 * Agrega aquí los nombres de artistas que sabes que pertenecen al sello
 */
const ARTISTS_KNOWN: string[] = [
  // Ejemplo: "Artista 1", "Artista 2", "Artista 3"
  // Agrega aquí los artistas conocidos de Dale Play Records
];

/**
 * Crawler mejorado que busca por artistas conocidos además de búsquedas generales
 */
export class EnhancedSpotifyCrawler {
  private spotifyClient: SpotifyClient;
  private supabaseClient: SupabaseClientWrapper;
  private trackProcessor: TrackProcessor;
  private processedIds: Set<string> = new Set();
  private stats = {
    totalFound: 0,
    totalProcessed: 0,
    totalSaved: 0,
    duplicates: 0,
    errors: 0,
  };

  constructor() {
    this.spotifyClient = new SpotifyClient();
    this.supabaseClient = new SupabaseClientWrapper();
    this.trackProcessor = new TrackProcessor(this.spotifyClient);
  }

  /**
   * Busca tracks por artistas conocidos y otros métodos
   */
  async crawl(): Promise<void> {
    console.log('🚀 Iniciando crawler mejorado de Spotify...');
    console.log(`📅 Buscando tracks desde ${config.crawler.startYear}`);
    console.log(`🏷️  Label objetivo: "${config.crawler.labelSearchTerm}"`);

    // Cargar IDs existentes
    console.log('📊 Cargando tracks existentes de la base de datos...');
    const existingIds = await this.supabaseClient.getExistingSpotifyIds();
    this.processedIds = new Set(existingIds);
    console.log(`✅ ${this.processedIds.size} tracks ya existen en la base de datos`);

    // Buscar por artistas conocidos
    if (ARTISTS_KNOWN.length > 0) {
      console.log(`\n🎤 Buscando por ${ARTISTS_KNOWN.length} artistas conocidos...`);
      for (const artist of ARTISTS_KNOWN) {
        console.log(`\n🔍 Buscando tracks de: "${artist}"`);
        await this.searchByArtist(artist);
      }
    } else {
      console.log('\n⚠️  No hay artistas conocidos configurados. Usa el crawler estándar.');
    }

    // También ejecutar búsquedas generales
    console.log('\n🔍 Ejecutando búsquedas generales...');
    await this.searchGeneral();

    // Mostrar estadísticas
    this.printStats();
  }

  /**
   * Busca tracks de un artista específico
   */
  private async searchByArtist(artistName: string): Promise<void> {
    let offset = 0;
    const limit = 50;
    const maxResults = 200; // Límite por artista
    let hasMore = true;

    while (hasMore && offset < maxResults) {
      try {
        const query = `artist:"${artistName}"`;
        const searchResult = await this.spotifyClient.searchTracks(query, limit, offset);
        const tracks = searchResult.tracks.items;

        if (tracks.length === 0) {
          hasMore = false;
          break;
        }

        this.stats.totalFound += tracks.length;
        console.log(`   📦 Encontrados ${tracks.length} tracks (offset: ${offset})`);

        // Filtrar tracks nuevos
        const newTracks = tracks.filter(track => !this.processedIds.has(track.id));

        if (newTracks.length > 0) {
          const processedTracks = await this.processTracks(newTracks);
          
          if (processedTracks.length > 0) {
            await this.supabaseClient.upsertTracks(processedTracks);
            this.stats.totalSaved += processedTracks.length;
            console.log(`   ✅ Guardados ${processedTracks.length} tracks del label`);
            processedTracks.forEach(t => this.processedIds.add(t.spotify_id));
          }
        }

        hasMore = searchResult.tracks.next !== null;
        offset += limit;
        await this.sleep(200);

      } catch (error) {
        console.error(`   ❌ Error buscando artista "${artistName}":`, error);
        this.stats.errors++;
        hasMore = false;
      }
    }
  }

  /**
   * Búsquedas generales (similar al crawler estándar)
   */
  private async searchGeneral(): Promise<void> {
    const queries = [
      `"${config.crawler.labelSearchTerm}"`,
      `"Dale Play Records"`,
    ];

    for (const query of queries) {
      console.log(`\n🔍 Buscando: "${query}"`);
      await this.searchAndProcess(query);
    }
  }

  /**
   * Busca tracks con una query y los procesa
   */
  private async searchAndProcess(query: string): Promise<void> {
    let offset = 0;
    const limit = 50;
    const maxResultsPerQuery = 500;
    let hasMore = true;

    while (hasMore && offset < maxResultsPerQuery) {
      try {
        const searchResult = await this.spotifyClient.searchTracks(query, limit, offset);
        const tracks = searchResult.tracks.items;

        if (tracks.length === 0) {
          hasMore = false;
          break;
        }

        this.stats.totalFound += tracks.length;
        const newTracks = tracks.filter(track => !this.processedIds.has(track.id));

        if (newTracks.length > 0) {
          const processedTracks = await this.processTracks(newTracks);
          
          if (processedTracks.length > 0) {
            await this.supabaseClient.upsertTracks(processedTracks);
            this.stats.totalSaved += processedTracks.length;
            processedTracks.forEach(t => this.processedIds.add(t.spotify_id));
          }
        }

        hasMore = searchResult.tracks.next !== null;
        offset += limit;
        await this.sleep(200);

      } catch (error) {
        console.error(`   ❌ Error en búsqueda:`, error);
        this.stats.errors++;
        hasMore = false;
      }
    }
  }

  /**
   * Procesa una lista de tracks
   */
  private async processTracks(tracks: SpotifyTrack[]): Promise<any[]> {
    const batchSize = 10;
    const results: any[] = [];

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const processed = await this.trackProcessor.processTracks(batch);
      results.push(...processed);
      this.stats.totalProcessed += batch.length;

      if (i + batchSize < tracks.length) {
        await this.sleep(300);
      }
    }

    return results;
  }

  /**
   * Imprime estadísticas
   */
  private printStats(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 ESTADÍSTICAS FINALES');
    console.log('='.repeat(50));
    console.log(`Total encontrados: ${this.stats.totalFound}`);
    console.log(`Total procesados: ${this.stats.totalProcessed}`);
    console.log(`Total guardados: ${this.stats.totalSaved}`);
    console.log(`Duplicados: ${this.stats.duplicates}`);
    console.log(`Errores: ${this.stats.errors}`);
    console.log('='.repeat(50));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

