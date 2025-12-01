import { Request, Response } from 'express';
import axios from 'axios';

/**
 * GET /api/auth/login
 * Inicia el flujo de autenticación con Spotify
 */
export async function login(req: Request, res: Response) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    
    // SIEMPRE usar la redirect URI de las variables de entorno (debe coincidir exactamente con Spotify Dashboard)
    let redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    
    if (!redirectUri) {
      // Si no está configurada, construirla desde el request
      // En Vercel, siempre usar HTTPS
      const host = req.get('host');
      // Verificar headers de Vercel para HTTPS
      const isHttps = req.get('x-forwarded-proto') === 'https' || 
                      req.get('x-forwarded-ssl') === 'on' ||
                      process.env.VERCEL === '1';
      const protocol = isHttps ? 'https' : 'https'; // Siempre HTTPS en producción
      redirectUri = `${protocol}://${host}/api/auth/callback`;
      console.warn(`⚠️  SPOTIFY_REDIRECT_URI no configurada. Usando: ${redirectUri}`);
      console.warn(`⚠️  IMPORTANTE: Esta URI debe coincidir EXACTAMENTE con la configurada en Spotify Dashboard`);
    }
    
    // Log para debugging
    console.log(`🔗 Redirect URI que se usará: ${redirectUri}`);
    
    if (!clientId) {
      return res.status(500).json({ error: 'SPOTIFY_CLIENT_ID no configurado' });
    }

    const scopes = [
      'user-read-private',
      'user-read-email',
    ].join(' ');
    
    const authUrl = `https://accounts.spotify.com/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}`;
    
    console.log(`🚀 Redirigiendo a Spotify con redirect_uri: ${redirectUri}`);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error iniciando autenticación', message: error.message });
  }
}

/**
 * GET /api/auth/callback
 * Recibe el código de autorización y obtiene tokens
 */
export async function callback(req: Request, res: Response) {
  try {
    const { code, error } = req.query;
    
    if (error) {
      return res.redirect(`/?auth=error&message=${encodeURIComponent(error as string)}`);
    }
    
    if (!code) {
      return res.redirect('/?auth=error&message=No se recibió código de autorización');
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    // SIEMPRE usar la redirect URI de las variables de entorno (debe coincidir exactamente con Spotify Dashboard)
    let redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    
    if (!redirectUri) {
      // Si no está configurada, construirla desde el request
      // En Vercel, siempre usar HTTPS
      const host = req.get('host');
      // Verificar headers de Vercel para HTTPS
      const isHttps = req.get('x-forwarded-proto') === 'https' || 
                      req.get('x-forwarded-ssl') === 'on' ||
                      process.env.VERCEL === '1';
      const protocol = isHttps ? 'https' : 'https'; // Siempre HTTPS en producción
      redirectUri = `${protocol}://${host}/api/auth/callback`;
      console.warn(`⚠️  SPOTIFY_REDIRECT_URI no configurada. Usando: ${redirectUri}`);
    }
    
    console.log(`🔗 Callback usando redirect URI: ${redirectUri}`);
    
    if (!clientId || !clientSecret) {
      return res.redirect('/?auth=error&message=Credenciales no configuradas');
    }

    // Intercambiar código por tokens
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    // Guardar token en localStorage del frontend mediante query param
    // El frontend lo capturará y lo guardará
    res.redirect(`/?auth=success&token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error: any) {
    console.error('Error en callback:', error);
    const errorMsg = error.response?.data?.error_description || error.message || 'Error desconocido';
    res.redirect(`/?auth=error&message=${encodeURIComponent(errorMsg)}`);
  }
}

