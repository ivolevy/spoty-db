import express from 'express';
import dotenv from 'dotenv';
import { getAllTracks, getTrackById } from './api/tracks';
import { getAllArtists, getArtistTracks } from './api/artists';
import { getGlobalMetrics, getArtistMetrics } from './api/metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📅 Iniciado: ${new Date().toISOString()}`);
});

