import { Request, Response } from 'express';
import { SpotifyService } from '../services/spotify';

// Instancia global del servicio de Spotify (compartida con sync)
let spotifyServiceInstance: SpotifyService | null = null;

/**
 * Establece la instancia del servicio de Spotify para compartir tokens
 */
export function setSpotifyServiceInstance(service: SpotifyService) {
  spotifyServiceInstance = service;
}

/**
 * Obtiene la instancia compartida del servicio de Spotify
 */
export function getSpotifyServiceInstance(): SpotifyService | null {
  return spotifyServiceInstance;
}

/**
 * POST /api/token
 * Recibe el token de usuario desde el frontend y lo configura en el servicio
 */
export async function setUserToken(req: Request, res: Response) {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    // Si hay una instancia del servicio, establecer el token
    if (spotifyServiceInstance) {
      spotifyServiceInstance.setUserToken(token);
      return res.json({ 
        success: true, 
        message: 'Token de usuario configurado correctamente' 
      });
    }

    // Si no hay instancia, crear una nueva y establecer el token
    const spotify = new SpotifyService();
    spotify.setUserToken(token);
    setSpotifyServiceInstance(spotify);
    
    res.json({ 
      success: true, 
      message: 'Token de usuario configurado correctamente' 
    });
  } catch (error: any) {
    console.error('Error configurando token:', error);
    res.status(500).json({ error: 'Error configurando token', message: error.message });
  }
}

/**
 * GET /api/token/status
 * Verifica si hay un token de usuario configurado
 */
export async function getTokenStatus(req: Request, res: Response) {
  try {
    const spotify = spotifyServiceInstance || new SpotifyService();
    const hasToken = !!spotify.getUserToken();
    
    res.json({ 
      hasToken,
      message: hasToken ? 'Token de usuario configurado' : 'No hay token de usuario configurado'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error verificando token', message: error.message });
  }
}

