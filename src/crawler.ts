import { SpotifyClient } from './spotify-client';
import { SupabaseClientWrapper } from './supabase-client';
import { TrackProcessor } from './track-processor';
import { config } from './config';
import { SpotifyTrack } from './types';

/**
 * Crawler principal que busca y procesa tracks de Spotify
 */
export class SpotifyCrawler {
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
   * Busca tracks por diferentes criterios y los procesa
   */
  async crawl(): Promise<void> {
    console.log('🚀 Iniciando crawler de Spotify...');
    console.log(`📅 Buscando tracks desde ${config.crawler.startYear}`);
    console.log(`🏷️  Label objetivo: "${config.crawler.labelSearchTerm}"`);

    // Cargar IDs existentes para deduplicación
    console.log('📊 Cargando tracks existentes de la base de datos...');
    try {
      const existingIds = await this.supabaseClient.getExistingSpotifyIds();
      this.processedIds = new Set(existingIds);
      console.log(`✅ ${this.processedIds.size} tracks ya existen en la base de datos`);
    } catch (error: any) {
      console.error('❌ Error cargando tracks existentes:', error.message);
      console.log('⚠️  Continuando sin deduplicación previa...');
      this.processedIds = new Set(); // Continuar con set vacío
    }

    // Estrategias de búsqueda múltiples
    const searchQueries = this.generateSearchQueries();

    for (const query of searchQueries) {
      console.log(`\n🔍 Buscando: "${query}"`);
      await this.searchAndProcess(query);
    }

    // Mostrar estadísticas finales
    this.printStats();
  }

  /**
   * Genera queries de búsqueda variadas para encontrar más tracks
   * Nota: Spotify API no permite búsqueda directa por label, así que buscamos
   * de manera amplia y filtramos por label en el procesamiento
   */
  private generateSearchQueries(): string[] {
    const label = config.crawler.labelSearchTerm;
    const currentYear = new Date().getFullYear();
    const queries: string[] = [];

    if (config.crawler.testMode) {
      // Modo prueba: solo búsquedas simples y últimos años
      console.log('🧪 Modo TEST activado - búsqueda limitada');
      queries.push(`"${label}"`);
      queries.push(`year:${currentYear}`);
      queries.push(`year:${currentYear - 1}`);
      return queries;
    }

    // Modo normal: búsquedas completas
    // Estrategia 1: Buscar por términos del label en texto libre
    queries.push(`"${label}"`);
    queries.push(`"Dale Play Records"`);
    queries.push(`"DALE PLAY RECORDS"`);
    queries.push(`"DalePlay Records"`);

    // Estrategia 2: Buscar solo en los últimos 3 años para eficiencia
    const recentYears = Math.min(3, currentYear - config.crawler.startYear + 1);
    for (let i = 0; i < recentYears; i++) {
      const year = currentYear - i;
      queries.push(`year:${year}`);
    }

    return queries;
  }

  /**
   * Busca tracks con una query y los procesa
   */
  private async searchAndProcess(query: string): Promise<void> {
    let offset = 0;
    const limit = 50; // Máximo permitido por Spotify
    const maxResultsPerQuery = config.crawler.testMode ? 100 : 1000; // Límite más bajo en modo test
    let hasMore = true;
    const maxTracksToProcess = config.crawler.maxTracks > 0 ? config.crawler.maxTracks : Infinity;

    while (hasMore && offset < maxResultsPerQuery && this.stats.totalSaved < maxTracksToProcess) {
      try {
        const searchResult = await this.spotifyClient.searchTracks(query, limit, offset);
        const tracks = searchResult.tracks.items;

        if (tracks.length === 0) {
          hasMore = false;
          break;
        }

        this.stats.totalFound += tracks.length;
        console.log(`   📦 Encontrados ${tracks.length} tracks (offset: ${offset})`);

        // Filtrar tracks que ya procesamos
        const newTracks = tracks.filter(track => !this.processedIds.has(track.id));

        if (newTracks.length === 0) {
          console.log(`   ⏭️  Todos los tracks ya fueron procesados`);
          this.stats.duplicates += tracks.length;
        } else {
          // Procesar tracks (esto filtra por label automáticamente)
          const processedTracks = await this.processTracks(newTracks);

          if (processedTracks.length > 0) {
            // Guardar en Supabase
            await this.supabaseClient.upsertTracks(processedTracks);
            this.stats.totalSaved += processedTracks.length;
            console.log(`   ✅ Guardados ${processedTracks.length} tracks del label`);

            // Agregar a processedIds para evitar duplicados en esta sesión
            processedTracks.forEach(t => this.processedIds.add(t.spotify_id));
          } else {
            console.log(`   ℹ️  Ningún track de estos coincide con el label`);
          }
        }

        // Verificar si hay más resultados
        hasMore = searchResult.tracks.next !== null;
        offset += limit;

        // Pequeña pausa para evitar rate limits
        await this.sleep(200);

      } catch (error) {
        console.error(`   ❌ Error en búsqueda (offset ${offset}):`, error);
        this.stats.errors++;
        hasMore = false;
      }
    }
  }

  /**
   * Procesa una lista de tracks
   */
  private async processTracks(tracks: SpotifyTrack[]): Promise<any[]> {
    const batchSize = 10; // Procesar en batches pequeños para evitar rate limits
    const results: any[] = [];

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const processed = await this.trackProcessor.processTracks(batch);
      results.push(...processed);
      this.stats.totalProcessed += batch.length;

      // Pausa entre batches
      if (i + batchSize < tracks.length) {
        await this.sleep(300);
      }
    }

    return results;
  }

  /**
   * Imprime estadísticas del crawler
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

  /**
   * Utilidad para pausar la ejecución
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const crawler = new SpotifyCrawler();
  crawler.crawl()
    .then(() => {
      console.log('\n✅ Crawler completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en el crawler:', error);
      process.exit(1);
    });
}

