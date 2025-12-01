import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function setupDatabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL y SUPABASE_SECRET_KEY o SUPABASE_ANON_KEY son requeridos');
  }

  const supabase = createClient(url, key);

  // Leer el schema SQL
  const schemaPath = path.join(__dirname, '../supabase-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('📄 Schema SQL:');
  console.log(schema);
  console.log('\n⚠️  Por favor ejecuta este SQL manualmente en el SQL Editor de Supabase');
  console.log('   O usa la CLI de Supabase para ejecutarlo automáticamente');
}

setupDatabase().catch(console.error);

