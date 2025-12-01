import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase';

const supabase = new SupabaseService();

/**
 * GET /artists
 * Devuelve lista de artistas
 */
export async function getAllArtists(req: Request, res: Response) {
  try {
    const artists = await supabase.getAllArtists();
    res.json(artists);
  } catch (error: any) {
    console.error('Error en GET /artists:', error);
    res.status(500).json({ error: 'Error obteniendo artistas', message: error.message });
  }
}

/**
 * GET /artists/:name/tracks
 * Devuelve las 5 canciones guardadas del artista
 */
export async function getArtistTracks(req: Request, res: Response) {
  try {
    const { name } = req.params;
    const tracks = await supabase.getTracksByArtist(name);
    res.json(tracks);
  } catch (error: any) {
    console.error(`Error en GET /artists/${req.params.name}/tracks:`, error);
    res.status(500).json({ error: 'Error obteniendo tracks del artista', message: error.message });
  }
}

