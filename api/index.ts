import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { getAllTracks, getTrackById } from '../src/api/tracks';
import { getAllArtists, getArtistTracks } from '../src/api/artists';
import { getGlobalMetrics, getArtistMetrics } from '../src/api/metrics';

dotenv.config();

const app = express();

app.use(express.json());

// Serve static files from public directory
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint - serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
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

// Catch-all for SPA - serve index.html for any non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/tracks') || 
      req.path.startsWith('/artists') || 
      req.path.startsWith('/metrics') ||
      req.path.startsWith('/health')) {
    return next();
  }
  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Export handler for Vercel
export default app;

