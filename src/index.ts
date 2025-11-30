/**
 * Punto de entrada principal del sistema
 * Puede ejecutarse como crawler único o como cron job
 */

import { CronJobManager } from './cron-job';
import { SpotifyCrawler } from './crawler';

async function main() {
  const args = process.argv.slice(2);

  // Modo crawler único (una ejecución)
  if (args.includes('--crawl') || args.includes('--once')) {
    console.log('🚀 Modo: Ejecución única (crawler)');
    const crawler = new SpotifyCrawler();
    await crawler.crawl();
    return;
  }

  // Modo cron job
  if (args.includes('--cron')) {
    console.log('⏰ Modo: Cron job (ejecución semanal)');
    const cronManager = new CronJobManager();
    
    // Permitir customizar el schedule
    const scheduleIndex = args.indexOf('--schedule');
    const schedule = scheduleIndex !== -1 && args[scheduleIndex + 1]
      ? args[scheduleIndex + 1]
      : '0 2 * * 1'; // Lunes 2 AM por defecto

    cronManager.start(schedule);
    
    // Mantener proceso vivo
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo...');
      cronManager.stop();
      process.exit(0);
    });
    
    return;
  }

  // Modo por defecto: ejecución única
  console.log('🚀 Ejecutando crawler (modo por defecto)');
  console.log('💡 Usa --cron para modo cron job, --crawl para ejecución única');
  const crawler = new SpotifyCrawler();
  await crawler.crawl();
}

main()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

