import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SyncService } from '../src/services/sync';
import { getSpotifyServiceInstance } from '../src/api/token';
import { SpotifyService } from '../src/services/spotify';

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

    // Responder inmediatamente para evitar timeout de Vercel
    res.status(202).json({
      success: true,
      message: 'Cron job iniciado. Revisa los logs en Vercel para ver el progreso.',
      timestamp: new Date().toISOString(),
    });

    // Ejecutar sincronización en segundo plano (sin await para que no bloquee)
    // Pero necesitamos await para que los errores se capturen
    // Usar instancia compartida de SpotifyService si está disponible (para usar token de usuario)
    const spotifyInstance = getSpotifyServiceInstance() || new SpotifyService();
    const syncService = new SyncService(spotifyInstance);
    
    // Ejecutar con timeout global de 50 segundos (límite de Vercel para funciones)
    const syncPromise = syncService.syncArtists();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync timeout after 50s')), 50000)
    );

    await Promise.race([syncPromise, timeoutPromise]);
    
    console.log('✅ Cron job completado exitosamente');
  } catch (error: any) {
    console.error('❌ Error en cron job:', error);
    console.error('Stack:', error.stack);
    // Los errores se verán en los logs de Vercel
  }
}

