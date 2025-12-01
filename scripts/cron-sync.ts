import dotenv from 'dotenv';
import { SyncService } from '../src/services/sync';

dotenv.config();

async function main() {
  try {
    console.log('🔄 Iniciando cron job de sincronización...');
    const syncService = new SyncService();
    await syncService.syncArtists();
    console.log('✅ Cron job completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en cron job:', error);
    process.exit(1);
  }
}

main();

