-- Tabla para almacenar tracks de artistas
create table artist_tracks (
  id bigserial primary key,
  spotify_id text unique not null,
  name text,
  artists text[],
  artist_main text,
  album text,
  release_date date,
  duration_ms int,
  bpm numeric,
  genres text[],
  preview_url text,
  cover_url text,
  fetched_at timestamptz default now()
);

-- Índices para mejorar performance
create index on artist_tracks(artist_main);
create index on artist_tracks(spotify_id);

