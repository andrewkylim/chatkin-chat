import dotenv from 'dotenv';

dotenv.config({ path: 'apps/worker/.dev.vars' });

const userId = '4e681c69-8baf-4707-94ae-6396a2daf521';
const workerUrl = 'https://chatkin.ai/api';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function triggerOnboarding() {
  console.log('Triggering onboarding generation...');

  // Call the onboarding endpoint with service role key
  const response = await fetch(`${workerUrl}/generate-onboarding`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'X-User-ID': userId  // Pass user ID as header
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Onboarding generation failed:', response.status, error);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Onboarding generated:', result);

  // Trigger notes generation
  console.log('\nTriggering notes generation...');
  const notesResponse = await fetch(`${workerUrl}/generate-notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'X-User-ID': userId
    }
  });

  if (!notesResponse.ok) {
    const error = await notesResponse.text();
    console.error('Notes generation failed:', notesResponse.status, error);
    process.exit(1);
  }

  const notesResult = await notesResponse.json();
  console.log('✅ Notes generated:', notesResult);
}

triggerOnboarding().catch(console.error);
