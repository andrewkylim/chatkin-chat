import * as dotenv from 'dotenv';

dotenv.config({ path: 'apps/worker/.dev.vars' });

const userId = '4e681c69-8baf-4707-94ae-6396a2daf521';
const workerUrl = 'https://chatkin.ai';

console.log('Triggering assessment processing for user:', userId);

// Call the generate-onboarding endpoint
const response = await fetch(`${workerUrl}/api/generate-onboarding`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-User-ID': userId
  }
});

const result = await response.json();
console.log('Response status:', response.status);
console.log('Response:', JSON.stringify(result, null, 2));
