export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  genres: string[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    release_date: string;
    images: Array<{
      url: string;
    }>;
  };
  duration_ms: number;
  preview_url: string | null;
}

export interface SpotifyAudioFeatures {
  id: string;
  tempo: number; // BPM
  duration_ms: number;
}

export interface TrackData {
  spotify_id: string;
  name: string;
  artists: string[];
  artist_main: string;
  album: string;
  release_date: string | null;
  duration_ms: number;
  bpm: number | null;
  genres: string[];
  preview_url: string | null;
  cover_url: string | null;
}

export interface ArtistInfo {
  name: string;
  id: string;
}

export interface MetricsGlobal {
  total_tracks: number;
  bpm_average: number | null;
  genre_distribution: Record<string, number>;
  tracks_by_artist: Record<string, number>;
  avg_bpm_by_artist: Record<string, number>;
}

export interface MetricsArtist {
  total_tracks: number;
  bpm_promedio: number | null;
  generos_predominantes: string[];
  distribuciones_release_date: Record<string, number>;
}

