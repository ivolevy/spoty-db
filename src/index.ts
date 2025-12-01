// IMPORTANTE: dotenv.config() debe ejecutarse ANTES de cualquier importación
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { getAllTracks, getTrackById } from './api/tracks';
import { getAllArtists, getArtistTracks } from './api/artists';
import { getGlobalMetrics, getArtistMetrics } from './api/metrics';
import { login, callback } from './api/auth';
import { debugAuth } from './api/auth-debug';
import { setUserToken, getTokenStatus, setSpotifyServiceInstance } from './api/token';
import { syncArtists } from './api/sync';
import { SpotifyService } from './services/spotify';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy para que funcione correctamente en desarrollo
app.set('trust proxy', true);

app.use(express.json());

// Crear instancia compartida de SpotifyService para compartir tokens
const spotifyService = new SpotifyService();
setSpotifyServiceInstance(spotifyService);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint - serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📅 Iniciado: ${new Date().toISOString()}`);
  console.log(`📁 Archivos estáticos servidos desde: ${path.join(__dirname, '../public')}`);
});
