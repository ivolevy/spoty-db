import { SpotifyCrawler } from './crawler';
import { SupabaseClientWrapper } from './supabase-client';

/**
 * Script de sincronización semanal
 * Busca solo nuevos lanzamientos y actualiza información existente
 */
export class WeeklySync {
  private crawler: SpotifyCrawler;
  private supabaseClient: SupabaseClientWrapper;

  constructor() {
    this.crawler = new SpotifyCrawler();
    this.supabaseClient = new SupabaseClientWrapper();
  }

  /**
   * Ejecuta la sincronización semanal
   */
  async sync(): Promise<void> {
    console.log('🔄 Iniciando sincronización semanal...');
    const startTime = Date.now();

    try {
      // Obtener conteo antes
      const countBefore = await this.supabaseClient.getTrackCount();
      console.log(`📊 Tracks en base de datos antes: ${countBefore}`);

      // Ejecutar crawler (ya tiene deduplicación interna)
      await this.crawler.crawl();

      // Obtener conteo después
      const countAfter = await this.supabaseClient.getTrackCount();
      const added = countAfter - countBefore;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Sincronización completada en ${duration}s`);
      console.log(`📈 Tracks agregados/actualizados: ${added}`);
      console.log(`📊 Total en base de datos: ${countAfter}`);

    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      throw error;
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const sync = new WeeklySync();
  sync.sync()
    .then(() => {
      console.log('\n✅ Sincronización completada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en sincronización:', error);
      process.exit(1);
    });
}

