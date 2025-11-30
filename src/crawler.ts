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
  private maxTracksLimit: number;

  constructor() {
    this.spotifyClient = new SpotifyClient();
    this.supabaseClient = new SupabaseClientWrapper();
    this.trackProcessor = new TrackProcessor(this.spotifyClient);
    this.maxTracksLimit = config.crawler.maxTracksToProcess;
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
    
    if (config.crawler.testMode) {
      console.log('🧪 MODO TEST ACTIVADO: Búsquedas limitadas y máximo', this.maxTracksLimit, 'tracks');
    }

    for (const query of searchQueries) {
      // Si ya alcanzamos el límite, parar
      if (this.stats.totalSaved >= this.maxTracksLimit) {
        console.log(`\n⏹️  Límite alcanzado (${this.maxTracksLimit} tracks). Deteniendo búsqueda.`);
        break;
      }
      
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

    // Modo test: solo 2 búsquedas simples
    if (config.crawler.testMode) {
      queries.push(`"${label}"`);
      queries.push(`year:${currentYear}`);
      return queries;
    }

    // Modo normal: búsquedas completas
    queries.push(`"${label}"`);
    queries.push(`"Dale Play Records"`);
    queries.push(`"DALE PLAY RECORDS"`);
    queries.push(`"DalePlay Records"`);

    // Buscar en los últimos 3 años
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
    const maxResultsPerQuery = 1000; // Límite para evitar búsquedas infinitas
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
            // Limitar tracks si excede el máximo
            let tracksToSave = processedTracks;
            if (this.stats.totalSaved + processedTracks.length > this.maxTracksLimit) {
              const remaining = this.maxTracksLimit - this.stats.totalSaved;
              tracksToSave = processedTracks.slice(0, remaining);
              console.log(`   ⚠️  Límite alcanzado. Guardando solo ${remaining} de ${processedTracks.length} tracks.`);
            }
            
            // Guardar en Supabase
            await this.supabaseClient.upsertTracks(tracksToSave);
            this.stats.totalSaved += tracksToSave.length;
            console.log(`   ✅ Guardados ${tracksToSave.length} tracks del label`);

            // Agregar a processedIds para evitar duplicados en esta sesión
            tracksToSave.forEach(t => this.processedIds.add(t.spotify_id));
            
            // Si alcanzamos el límite, parar
            if (this.stats.totalSaved >= this.maxTracksLimit) {
              console.log(`   ⏹️  Límite de ${this.maxTracksLimit} tracks alcanzado.`);
              break;
            }
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

