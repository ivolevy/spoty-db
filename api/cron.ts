import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SyncService } from '../src/services/sync';

/**
 * Endpoint para Vercel Cron Job
 * Ejecuta la sincronización semanal de artistas
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verificar que sea una llamada del cron de Vercel
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Iniciando cron job desde Vercel...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    // Responder inmediatamente para evitar timeout
    res.status(202).json({
      success: true,
      message: 'Cron job iniciado. Revisa los logs en Vercel para ver el progreso.',
      timestamp: new Date().toISOString(),
    });

    // Ejecutar sincronización en segundo plano
    const syncService = new SyncService();
    await syncService.syncArtists();

    console.log('✅ Cron job completado exitosamente');
  } catch (error: any) {
    console.error('❌ Error en cron job:', error);
    // Los errores se verán en los logs de Vercel
  }
}

