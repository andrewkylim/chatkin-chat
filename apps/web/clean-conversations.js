/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root
dotenv.config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing Supabase credentials');
	console.log('PUBLIC_SUPABASE_URL:', supabaseUrl);
	console.log('PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'set' : 'not set');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanConversations() {
	try {
		// Get current user
		const { data: { user }, error: userError } = await supabase.auth.getUser();

		if (userError || !user) {
			console.error('Not authenticated. Please log in first.');
			console.error('Error:', userError);
			process.exit(1);
		}

		console.log(`Cleaning conversations for user: ${user.email}`);

		// Get all conversations for this user
		const { data: conversations, error: convError } = await supabase
			.from('conversations')
			.select('id, scope, title')
			.eq('user_id', user.id);

		if (convError) {
			console.error('Error fetching conversations:', convError);
			process.exit(1);
		}

		console.log(`Found ${conversations?.length || 0} conversations`);

		if (conversations && conversations.length > 0) {
			// Delete all messages for these conversations
			const conversationIds = conversations.map(c => c.id);

			const { error: msgError } = await supabase
				.from('messages')
				.delete()
				.in('conversation_id', conversationIds);

			if (msgError) {
				console.error('Error deleting messages:', msgError);
			} else {
				console.log('✓ Deleted all messages');
			}

			// Delete all conversations
			const { error: delError } = await supabase
				.from('conversations')
				.delete()
				.eq('user_id', user.id);

			if (delError) {
				console.error('Error deleting conversations:', delError);
			} else {
				console.log('✓ Deleted all conversations:');
				conversations.forEach(c => {
					console.log(`  - ${c.scope}: ${c.title}`);
				});
			}
		}

		console.log('\n✨ Cleanup complete! All conversations have been deleted.');
		console.log('The app will create fresh conversations when you visit each page.');
	} catch (error) {
		console.error('Unexpected error:', error);
		process.exit(1);
	}
}

cleanConversations();
