import dotenv from 'dotenv';

dotenv.config();

export const config = {
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    rateLimitRetries: parseInt(process.env.SPOTIFY_RATE_LIMIT_RETRIES || '5', 10),
    rateLimitDelay: parseInt(process.env.SPOTIFY_RATE_LIMIT_DELAY || '1000', 10),
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || '',
    // Usar secret key si está disponible, sino anon key (para operaciones server-side preferimos secret)
    key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || '',
  },
  crawler: {
    startYear: parseInt(process.env.START_YEAR || '2010', 10),
    labelSearchTerm: process.env.LABEL_SEARCH_TERM || 'dale play records',
    maxTracksToProcess: parseInt(process.env.MAX_TRACKS_TO_PROCESS || '50', 10), // Límite para pruebas
    testMode: process.env.TEST_MODE === 'true', // Modo test: menos búsquedas
  },
};

// Validar configuración crítica
if (!config.spotify.clientId || !config.spotify.clientSecret) {
  throw new Error('SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET son requeridos');
}

if (!config.supabase.url || (!config.supabase.anonKey && !config.supabase.secretKey)) {
  throw new Error('SUPABASE_URL y al menos SUPABASE_ANON_KEY o SUPABASE_SECRET_KEY son requeridos');
}

