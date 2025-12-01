import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { getAllTracks, getTrackById } from '../src/api/tracks';
import { getAllArtists, getArtistTracks } from '../src/api/artists';
import { getGlobalMetrics, getArtistMetrics } from '../src/api/metrics';
import { login, callback } from '../src/api/auth';

dotenv.config();

const app = express();

app.use(express.json());

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

// Tracks endpoints
app.get('/tracks', getAllTracks);
app.get('/tracks/:id', getTrackById);

// Artists endpoints
app.get('/artists', getAllArtists);
app.get('/artists/:name/tracks', getArtistTracks);

// Metrics endpoints
app.get('/metrics/global', getGlobalMetrics);
app.get('/metrics/artist/:name', getArtistMetrics);

// Export handler for Vercel
export default app;

