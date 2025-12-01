import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { getAllTracks, getTrackById } from '../src/api/tracks';
import { getAllArtists, getArtistTracks } from '../src/api/artists';
import { getGlobalMetrics, getArtistMetrics } from '../src/api/metrics';

dotenv.config();

const app = express();

app.use(express.json());

// Serve static files from public directory FIRST (before API routes)
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// API Routes - must come AFTER static files
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/tracks', getAllTracks);
app.get('/tracks/:id', getTrackById);

app.get('/artists', getAllArtists);
app.get('/artists/:name/tracks', getArtistTracks);

app.get('/metrics/global', getGlobalMetrics);
app.get('/metrics/artist/:name', getArtistMetrics);

// Root endpoint - serve HTML (must be LAST to catch all other routes)
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Catch-all for SPA routing - serve index.html for any other route
app.get('*', (req, res) => {
  // Only serve index.html if it's not an API route
  if (!req.path.startsWith('/api') && !req.path.startsWith('/tracks') && 
      !req.path.startsWith('/artists') && !req.path.startsWith('/metrics') && 
      !req.path.startsWith('/health')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Export handler for Vercel
export default app;

