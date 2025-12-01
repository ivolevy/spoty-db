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

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/tracks', getAllTracks);
app.get('/tracks/:id', getTrackById);

app.get('/artists', getAllArtists);
app.get('/artists/:name/tracks', getArtistTracks);

app.get('/metrics/global', getGlobalMetrics);
app.get('/metrics/artist/:name', getArtistMetrics);

// Root endpoint - serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Export handler for Vercel
export default app;

