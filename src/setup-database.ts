import { SupabaseClientWrapper } from './supabase-client';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

/**
 * Script para crear la tabla y índices en Supabase
 * Ejecutar una vez antes de usar el sistema
 */
async function setupDatabase(): Promise<void> {
  console.log('🔧 Configurando base de datos en Supabase...');

  if (!config.supabase.url || !config.supabase.key) {
    throw new Error('SUPABASE_URL y SUPABASE_KEY deben estar configurados');
  }

  const supabase = createClient(config.supabase.url, config.supabase.key);

  // SQL para crear la tabla
  const createTableSQL = `
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
  `;

  // SQL para crear índices
  const createIndexesSQL = [
    'CREATE INDEX IF NOT EXISTS idx_label_tracks_label_normalized ON label_tracks(label_normalized);',
    'CREATE INDEX IF NOT EXISTS idx_label_tracks_spotify_id ON label_tracks(spotify_id);',
    'CREATE INDEX IF NOT EXISTS idx_label_tracks_genre ON label_tracks(genre);',
  ];

  try {
    // Ejecutar creación de tabla
    console.log('📋 Creando tabla label_tracks...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL,
    });

    if (tableError) {
      // Si el RPC no existe, intentar con query directa
      console.log('⚠️  RPC no disponible, ejecuta este SQL manualmente en Supabase SQL Editor:');
      console.log('\n' + '='.repeat(60));
      console.log(createTableSQL);
      console.log('='.repeat(60));
    } else {
      console.log('✅ Tabla creada exitosamente');
    }

    // Crear índices
    console.log('\n📊 Creando índices...');
    for (const indexSQL of createIndexesSQL) {
      const { error: indexError } = await supabase.rpc('exec_sql', {
        sql: indexSQL,
      });

      if (indexError) {
        console.log('⚠️  Ejecuta este SQL manualmente en Supabase SQL Editor:');
        console.log(indexSQL);
      } else {
        console.log(`✅ Índice creado`);
      }
    }

    console.log('\n✅ Configuración de base de datos completada');
    console.log('\n📝 NOTA: Si algunos comandos fallaron, ejecuta el SQL manualmente en el SQL Editor de Supabase');

  } catch (error) {
    console.error('❌ Error configurando base de datos:', error);
    console.log('\n📝 Ejecuta este SQL manualmente en Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    console.log(createTableSQL);
    createIndexesSQL.forEach(sql => console.log(sql));
    console.log('='.repeat(60));
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('\n✅ Setup completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en setup:', error);
      process.exit(1);
    });
}

