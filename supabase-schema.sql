-- Script SQL para crear la tabla y índices en Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- Crear tabla label_tracks
CREATE TABLE IF NOT EXISTS label_tracks (
  id bigint generated always as identity primary key,
  spotify_id text unique,
  name text,
  artists text[],
  album text,
  label text,
  label_normalized text,
  release_date date,
  duration_ms int,
  genre text,
  bpm numeric,
  preview_url text,
  cover_url text,
  created_at timestamptz default now()
);

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_label_tracks_label_normalized ON label_tracks(label_normalized);
CREATE INDEX IF NOT EXISTS idx_label_tracks_spotify_id ON label_tracks(spotify_id);
CREATE INDEX IF NOT EXISTS idx_label_tracks_genre ON label_tracks(genre);

-- Índice adicional para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_label_tracks_release_date ON label_tracks(release_date);

