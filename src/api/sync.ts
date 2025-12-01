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
    console.log('🚀 Iniciando sincronización manual desde frontend...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    // Responder inmediatamente para evitar timeout
    res.status(202).json({
      success: true,
      message: 'Sincronización iniciada. Esto puede tardar unos minutos.',
      timestamp: new Date().toISOString(),
    });

    // Ejecutar sincronización en segundo plano
    // Usar instancia compartida de SpotifyService si está disponible (para usar token de usuario)
    const spotifyInstance = getSpotifyServiceInstance() || new SpotifyService();
    const syncService = new SyncService(spotifyInstance);
    
    // Ejecutar con timeout de 50 segundos
    const syncPromise = syncService.syncArtists();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync timeout after 50s')), 50000)
    );

    await Promise.race([syncPromise, timeoutPromise]);
    
    console.log('✅ Sincronización completada exitosamente');
  } catch (error: any) {
    console.error('❌ Error en sincronización:', error);
    console.error('Stack:', error.stack);
    // Los errores se verán en los logs, pero la respuesta ya se envió
  }
}

