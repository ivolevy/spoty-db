import { Request, Response } from 'express';
import axios from 'axios';

/**
 * GET /api/auth/login
 * Inicia el flujo de autenticación con Spotify
 */
export async function login(req: Request, res: Response) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 
      `${req.protocol}://${req.get('host')}/api/auth/callback`;
    
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
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 
      `${req.protocol}://${req.get('host')}/api/auth/callback`;
    
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
    
    // Guardar token en variable de entorno temporal (en producción, usar Redis o Supabase)
    // Por ahora, solo mostramos el token para que el usuario lo copie a .env
    const tokenInfo = {
      access_token,
      refresh_token,
      expires_in,
      instructions: 'Copia el access_token a tu archivo .env como SPOTIFY_USER_TOKEN'
    };
    
    // Redirigir con el token en la URL (solo para desarrollo)
    // En producción, guardar en base de datos
    res.redirect(`/?auth=success&token=${access_token.substring(0, 20)}...`);
  } catch (error: any) {
    console.error('Error en callback:', error);
    const errorMsg = error.response?.data?.error_description || error.message || 'Error desconocido';
    res.redirect(`/?auth=error&message=${encodeURIComponent(errorMsg)}`);
  }
}

