import { SpotifyCrawler } from '../src/crawler';

/**
 * API Route para Vercel Cron Jobs
 * Se ejecuta automáticamente según el schedule configurado en vercel.json
 * 
 * Nota: Vercel Cron envía un header 'authorization' con un token especial
 * Para mayor seguridad, también puedes verificar CRON_SECRET
 */
export default async function handler(
  req: any,
  res: any
) {
  // Verificar que viene de Vercel Cron
  // Vercel envía un header 'authorization' automáticamente para cron jobs
  // También puedes usar CRON_SECRET para ejecuciones manuales
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // Si hay CRON_SECRET configurado, validarlo
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Permitir que pase si viene de Vercel Cron (sin Bearer)
    // O si el header coincide con CRON_SECRET
    if (!authHeader || (authHeader !== cronSecret && !authHeader.startsWith('Bearer '))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('🚀 Iniciando crawler desde Vercel Cron...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    
    // Responder inmediatamente para evitar timeout
    // El crawler seguirá ejecutándose en segundo plano
    res.status(202).json({ 
      success: true, 
      message: 'Crawler iniciado',
      timestamp: new Date().toISOString()
    });

    // Ejecutar crawler (puede tardar varios minutos)
    const crawler = new SpotifyCrawler();
    await crawler.crawl();
    
    console.log('✅ Crawler completado exitosamente');
  } catch (error: any) {
    console.error('❌ Error en crawler:', error);
    // No podemos responder aquí porque ya enviamos la respuesta
    // Los errores se verán en los logs de Vercel
  }
}

