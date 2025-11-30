/**
 * Tipos TypeScript para el sistema de tracking de canciones
 */

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    label?: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
  preview_url: string | null;
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAudioFeatures {
  id: string;
  tempo: number; // BPM
  energy?: number;
  danceability?: number;
  valence?: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export interface TrackData {
  spotify_id: string;
  name: string;
  artists: string[];
  album: string;
  label: string;
  label_normalized: string;
  release_date: string;
  duration_ms: number;
  genre: string | null;
  bpm: number | null;
  preview_url: string | null;
  cover_url: string | null;
}

export interface SearchResult {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    next: string | null;
  };
}

