import express from 'express';
import dotenv from 'dotenv';
import { getAllTracks, getTrackById } from '../src/api/tracks';
import { getAllArtists, getArtistTracks } from '../src/api/artists';
import { getGlobalMetrics, getArtistMetrics } from '../src/api/metrics';

dotenv.config();

const app = express();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Spotify Artists Sync API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      tracks: '/tracks',
      artists: '/artists',
      metrics: '/metrics/global',
    },
  });
});

// Tracks endpoints
app.get('/tracks', getAllTracks);
app.get('/tracks/:id', getTrackById);

// Artists endpoints
app.get('/artists', getAllArtists);
app.get('/artists/:name/tracks', getArtistTracks);

// Metrics endpoints
app.get('/metrics/global', getGlobalMetrics);
app.get('/metrics/artist/:name', getArtistMetrics);

// Serve static files from public directory
app.use(express.static('public'));

// Export handler for Vercel
export default app;

