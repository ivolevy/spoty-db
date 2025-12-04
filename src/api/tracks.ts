import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase';

const supabase = new SupabaseService();

/**
 * GET /tracks
 * Devuelve todos los tracks guardados
 * Query params: ?genre=<genre> para filtrar por género
 */
export async function getAllTracks(req: Request, res: Response) {
  try {
    const genre = req.query.genre as string | undefined;
    const tracks = await supabase.getAllTracks();
    
    // Filtrar por género si se especifica
    if (genre) {
      const filteredTracks = tracks.filter((track: any) => {
        if (!track.genres || !Array.isArray(track.genres)) {
          return false;
        }
        return track.genres.some((g: string) => 
          g.toLowerCase() === genre.toLowerCase()
        );
      });
      return res.json(filteredTracks);
    }
    
    res.json(tracks);
  } catch (error: any) {
    console.error('Error en GET /tracks:', error);
    res.status(500).json({ error: 'Error obteniendo tracks', message: error.message });
  }
}

/**
 * GET /tracks/:id
 * Devuelve info detallada del track
 * El id puede ser el ID de la base de datos o el spotify_id
 */
export async function getTrackById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Intentar primero buscar por spotify_id (más común desde el frontend)
    let track = await supabase.getTrackBySpotifyId(id);
    
    // Si no se encuentra por spotify_id, intentar por ID de base de datos
    if (!track) {
      track = await supabase.getTrackById(id);
    }

    if (!track) {
      return res.status(404).json({ error: 'Track no encontrado' });
    }

    res.json(track);
  } catch (error: any) {
    console.error(`Error en GET /tracks/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error obteniendo track', message: error.message });
  }
}

