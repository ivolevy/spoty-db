import { SpotifyCrawler } from '../src/crawler';

/**
 * Endpoint público para ejecutar el crawler manualmente
 * No requiere autenticación especial (solo para uso manual desde la interfaz)
 */
export default async function handler(
  req: any,
  res: any
) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Iniciando crawler manual desde interfaz web...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    
    // Responder inmediatamente para evitar timeout
    res.status(202).json({ 
      success: true, 
      message: 'Crawler iniciado. Revisa los logs en Vercel para ver el progreso.',
      timestamp: new Date().toISOString()
    });

    // Ejecutar crawler en segundo plano
    const crawler = new SpotifyCrawler();
    await crawler.crawl();
    
    console.log('✅ Crawler completado exitosamente');
  } catch (error: any) {
    console.error('❌ Error en crawler:', error);
    // Los errores se verán en los logs de Vercel
  }
}

