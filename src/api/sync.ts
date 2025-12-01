import { Request, Response } from 'express';
import { SyncService } from '../services/sync';
import { getSpotifyServiceInstance } from './token';
import { SpotifyService } from '../services/spotify';

/**
 * POST /api/sync
 * Ejecuta la sincronización manual desde el frontend
 */
export async function syncArtists(req: Request, res: Response) {
  try {
    console.log('='.repeat(80));
    console.log('🚀 INICIANDO SINCRONIZACIÓN MANUAL DESDE FRONTEND');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🌐 Request desde: ${req.get('origin') || req.get('referer') || 'unknown'}`);
    console.log('='.repeat(80));

    // Verificar token de usuario
    const spotifyInstance = getSpotifyServiceInstance() || new SpotifyService();
    const hasUserToken = !!spotifyInstance.getUserToken();
    console.log(`🔑 Token de usuario disponible: ${hasUserToken ? 'SÍ' : 'NO'}`);
    
    if (!hasUserToken) {
      console.warn('⚠️  No hay token de usuario. BPM puede no estar disponible.');
    }

    // Responder inmediatamente para evitar timeout
    res.status(202).json({
      success: true,
      message: 'Sincronización iniciada. Esto puede tardar unos minutos.',
      timestamp: new Date().toISOString(),
      hasUserToken,
    });

    // Ejecutar sincronización en segundo plano
    const syncService = new SyncService(spotifyInstance);
    
    // Ejecutar con timeout aumentado a 3 minutos (180 segundos) para dar tiempo a todas las peticiones
    const syncPromise = syncService.syncArtists();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync timeout after 180s')), 180000)
    );

    await Promise.race([syncPromise, timeoutPromise]);
    
    console.log('✅ Sincronización completada exitosamente');
  } catch (error: any) {
    console.error('❌ Error en sincronización:', error);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
    // Los errores se verán en los logs de Vercel
  }
}

