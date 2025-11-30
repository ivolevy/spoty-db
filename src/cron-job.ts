import cron from 'node-cron';
import { WeeklySync } from './sync';

/**
 * Configuración del cron job semanal
 * Se ejecuta cada lunes a las 2:00 AM
 */
export class CronJobManager {
  private sync: WeeklySync;
  private task: cron.ScheduledTask | null = null;

  constructor() {
    this.sync = new WeeklySync();
  }

  /**
   * Inicia el cron job
   * Por defecto se ejecuta cada lunes a las 2:00 AM
   * Formato: minuto hora día-mes día-semana
   */
  start(schedule: string = '0 2 * * 1'): void {
    console.log('⏰ Iniciando cron job semanal...');
    console.log(`📅 Programado para ejecutarse: ${schedule}`);

    this.task = cron.schedule(schedule, async () => {
      console.log('\n' + '='.repeat(50));
      console.log(`🕐 Ejecutando sincronización programada - ${new Date().toISOString()}`);
      console.log('='.repeat(50));

      try {
        await this.sync.sync();
        console.log('✅ Sincronización programada completada exitosamente');
      } catch (error) {
        console.error('❌ Error en sincronización programada:', error);
      }
    });

    console.log('✅ Cron job iniciado correctamente');
  }

  /**
   * Detiene el cron job
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      console.log('⏹️  Cron job detenido');
    }
  }

  /**
   * Ejecuta la sincronización inmediatamente (útil para testing)
   */
  async runNow(): Promise<void> {
    console.log('🚀 Ejecutando sincronización inmediata...');
    await this.sync.sync();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const cronManager = new CronJobManager();

  // Opción para ejecutar inmediatamente si se pasa --now
  if (process.argv.includes('--now')) {
    cronManager.runNow()
      .then(() => {
        console.log('\n✅ Ejecución inmediata completada');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Error en ejecución inmediata:', error);
        process.exit(1);
      });
  } else {
    // Iniciar cron job
    cronManager.start();

    // Mantener el proceso vivo
    console.log('\n⏳ Cron job corriendo. Presiona Ctrl+C para detener...');
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo cron job...');
      cronManager.stop();
      process.exit(0);
    });
  }
}

