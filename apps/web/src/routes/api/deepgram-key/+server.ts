import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

// Endpoint to securely provide Deepgram API key to client
export const GET: RequestHandler = async () => {
	if (!env.DEEPGRAM_API_KEY) {
		return json({ error: 'API key not configured' }, { status: 500 });
	}

	return json({ apiKey: env.DEEPGRAM_API_KEY });
};
