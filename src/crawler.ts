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

    // Cargar IDs existentes para deduplicación (solo en modo normal)
    if (!config.crawler.testMode) {
      console.log('📊 Cargando tracks existentes...');
      try {
        const timeoutPromise = new Promise<Set<string>>((resolve) => {
          setTimeout(() => resolve(new Set()), 3000);
        });
        this.processedIds = await Promise.race([
          this.supabaseClient.getExistingSpotifyIds(),
          timeoutPromise
        ]);
      } catch (error: any) {
        this.processedIds = new Set();
      }
    } else {
      this.processedIds = new Set();
    }

    console.log(`🎤 Buscando por ${config.crawler.knownArtists.length} artistas: ${config.crawler.knownArtists.join(', ')}`);

    // Primero buscar por artistas conocidos (más eficiente)
    if (config.crawler.knownArtists.length > 0) {
      for (const artist of config.crawler.knownArtists) {
        if (this.stats.totalSaved >= this.maxTracksLimit) {
          break;
        }
        await this.searchByArtist(artist);
      }
    }

    // Luego hacer búsquedas generales (solo si NO está en modo test)
    if (!config.crawler.testMode && this.stats.totalSaved < this.maxTracksLimit) {
      const searchQueries = this.generateSearchQueries();
      for (const query of searchQueries) {
        if (this.stats.totalSaved >= this.maxTracksLimit) {
          break;
        }
        await this.searchAndProcess(query);
      }
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
   * Busca tracks de un artista específico
   */
  private async searchByArtist(artistName: string): Promise<void> {
    let offset = 0;
    const limit = 50;
    // En modo test, limitar a solo 50 tracks por artista para ser más rápido
    const maxResultsPerArtist = config.crawler.testMode ? 50 : 200;
    let hasMore = true;

    while (hasMore && offset < maxResultsPerArtist) {
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
            console.log(`   ✅ ${tracksToSave.length} tracks guardados`);

            // Agregar a processedIds para evitar duplicados en esta sesión
            tracksToSave.forEach(t => this.processedIds.add(t.spotify_id));
            
            // Si alcanzamos el límite, parar
            if (this.stats.totalSaved >= this.maxTracksLimit) {
              break;
            }
          }
        }

        // Verificar si hay más resultados
        hasMore = searchResult.tracks.next !== null;
        offset += limit;

        // Pequeña pausa para evitar rate limits
        await this.sleep(200);

      } catch (error) {
        console.error(`   ❌ Error buscando artista "${artistName}" (offset ${offset}):`, error);
        this.stats.errors++;
        hasMore = false;
      }
    }
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

