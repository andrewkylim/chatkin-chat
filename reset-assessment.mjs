import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'apps/worker/.dev.vars' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '4e681c69-8baf-4707-94ae-6396a2daf521';

console.log('Resetting assessment for user:', userId);

const { data, error } = await supabase
  .from('assessment_results')
  .update({
    onboarding_processed: false,
    onboarding_processed_at: null
  })
  .eq('user_id', userId);

if (error) {
  console.error('Error:', error);
} else {
  console.log('✅ Assessment reset successfully');
  console.log('You can now retrigger the processing');
}
