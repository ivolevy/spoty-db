import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase';

const supabase = new SupabaseService();

/**
 * GET /metrics/global
 * Devuelve métricas globales
 */
export async function getGlobalMetrics(req: Request, res: Response) {
  try {
    const metrics = await supabase.getGlobalMetrics();
    res.json(metrics);
  } catch (error: any) {
    console.error('Error en GET /metrics/global:', error);
    res.status(500).json({ error: 'Error obteniendo métricas globales', message: error.message });
  }
}

/**
 * GET /metrics/artist/:name
 * Devuelve métricas de un artista específico
 */
export async function getArtistMetrics(req: Request, res: Response) {
  try {
    const { name } = req.params;
    const metrics = await supabase.getArtistMetrics(name);
    res.json(metrics);
  } catch (error: any) {
    console.error(`Error en GET /metrics/artist/${req.params.name}:`, error);
    res.status(500).json({ error: 'Error obteniendo métricas del artista', message: error.message });
  }
}

