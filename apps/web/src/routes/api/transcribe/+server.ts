import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get the audio blob from the request
		const audioBlob = await request.blob();

		if (!env.DEEPGRAM_API_KEY) {
			console.error('DEEPGRAM_API_KEY not found in environment');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		// Send to Deepgram for transcription with improved parameters
		const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
			method: 'POST',
			headers: {
				Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
				'Content-Type': 'audio/webm'
			},
			body: audioBlob
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('Deepgram API error:', error);
			return json({ error: 'Transcription failed' }, { status: response.status });
		}

		const result = await response.json();
		const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

		return json({ transcript });
	} catch (error) {
		console.error('Transcription error:', error);
		return json({ error: 'Failed to transcribe audio' }, { status: 500 });
	}
};
