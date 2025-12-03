/**
 * Seed 6 domain projects for a user
 * Run: node seed-projects.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/worker/.dev.vars' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '4e681c69-8baf-4707-94ae-6396a2daf521';

const domainProjects = [
  { domain: 'Body', description: 'Physical health, fitness & energy', emoji: '💪' },
  { domain: 'Mind', description: 'Mental & emotional wellbeing', emoji: '🧠' },
  { domain: 'Purpose', description: 'Work, meaning & fulfillment', emoji: '🎯' },
  { domain: 'Connection', description: 'Relationships & community', emoji: '🤝' },
  { domain: 'Growth', description: 'Learning & development', emoji: '🌱' },
  { domain: 'Finance', description: 'Financial & resource stability', emoji: '💰' }
];

async function seedProjects() {
  console.log('Checking existing projects...');

  const { data: existing } = await supabase
    .from('projects')
    .select('domain')
    .eq('user_id', userId);

  const existingDomains = new Set(existing?.map(p => p.domain) || []);
  console.log('Existing domains:', Array.from(existingDomains));

  const projectsToCreate = domainProjects
    .filter(p => !existingDomains.has(p.domain))
    .map(p => ({
      user_id: userId,
      name: p.domain,
      domain: p.domain,
      description: p.description,
      color: p.emoji
    }));

  if (projectsToCreate.length === 0) {
    console.log('All domain projects already exist!');
    return;
  }

  console.log(`Creating ${projectsToCreate.length} missing projects...`);

  const { data, error } = await supabase
    .from('projects')
    .insert(projectsToCreate)
    .select();

  if (error) {
    console.error('Error creating projects:', error);
    process.exit(1);
  }

  console.log('✅ Successfully created projects:');
  data.forEach(p => console.log(`  - ${p.name} (${p.domain})`));
}

seedProjects().catch(console.error);
