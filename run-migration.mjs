import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/worker/.dev.vars' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync('packages/database/migrations/022_add_domain_to_tasks_and_notes.sql', 'utf8');

console.log('Running migration...');
const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

if (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}

console.log('✅ Migration completed successfully');
