import { Request, Response } from 'express';

/**
 * GET /api/auth/debug
 * Endpoint de debug para verificar la configuración de autenticación
 */
export async function debugAuth(req: Request, res: Response) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const host = req.get('host');
  const protocol = req.protocol || 'https';
  const autoRedirectUri = `${protocol}://${host}/api/auth/callback`;
  
  res.json({
    clientId: clientId ? `${clientId.substring(0, 10)}...` : 'NO CONFIGURADO',
    redirectUriFromEnv: redirectUri || 'NO CONFIGURADO',
    autoRedirectUri: autoRedirectUri,
    redirectUriUsed: redirectUri || autoRedirectUri,
    host: host,
    protocol: protocol,
    instructions: {
      step1: 'Ve a https://developer.spotify.com/dashboard',
      step2: 'Selecciona tu app',
      step3: 'En "Redirect URIs", agrega EXACTAMENTE esta URL:',
      redirectUriToAdd: redirectUri || autoRedirectUri,
      step4: 'Guarda los cambios',
      step5: 'Configura SPOTIFY_REDIRECT_URI en Vercel con la misma URL'
    }
  });
}

