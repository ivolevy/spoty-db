import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { getAllTracks, getTrackById } from '../src/api/tracks';
import { getAllArtists, getArtistTracks } from '../src/api/artists';
import { getGlobalMetrics, getArtistMetrics } from '../src/api/metrics';
import { login, callback } from '../src/api/auth';
import { debugAuth } from '../src/api/auth-debug';
import { setUserToken, getTokenStatus, setSpotifyServiceInstance } from '../src/api/token';
import { syncArtists } from '../src/api/sync';
import { SpotifyService } from '../src/services/spotify';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy para que Vercel detecte correctamente HTTPS
app.set('trust proxy', true);

app.use(express.json());

// Crear instancia compartida de SpotifyService para compartir tokens
const spotifyService = new SpotifyService();
setSpotifyServiceInstance(spotifyService);

// Serve static files from public directory
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint - serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Auth endpoints
app.get('/api/auth/login', login);
app.get('/api/auth/callback', callback);
app.get('/api/auth/debug', debugAuth);

// Fallback para /callback
app.get('/callback', (req, res) => {
  const queryString = new URLSearchParams(req.query as any).toString();
  res.redirect(`/api/auth/callback?${queryString}`);
});

// Token endpoints
app.post('/api/token', setUserToken);
app.get('/api/token/status', getTokenStatus);

// Sync endpoint
app.post('/api/sync', syncArtists);

// Tracks endpoints
app.get('/tracks', getAllTracks);
app.get('/tracks/:id', getTrackById);

// Artists endpoints
app.get('/artists', getAllArtists);
app.get('/artists/:name/tracks', getArtistTracks);

// Metrics endpoints
app.get('/metrics/global', getGlobalMetrics);
app.get('/metrics/artist/:name', getArtistMetrics);

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Servidor local iniciado');
  console.log('='.repeat(60));
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📅 Iniciado: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('\n💡 Presiona Ctrl+C para detener el servidor\n');
});

