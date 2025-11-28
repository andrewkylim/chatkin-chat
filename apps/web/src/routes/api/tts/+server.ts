import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

// Amazon Polly TTS endpoint
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { text } = await request.json();

		if (!text) {
			return json({ error: 'Text is required' }, { status: 400 });
		}

		// Validate AWS credentials
		if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_REGION) {
			return json({ error: 'AWS credentials not configured' }, { status: 500 });
		}

		// Use AWS Polly API with standard voice (Matthew - cheapest male voice)
		const pollyEndpoint = `https://polly.${env.AWS_REGION}.amazonaws.com/v1/speech`;

		// Create AWS signature v4 for authentication
		const region = env.AWS_REGION;
		const service = 'polly';
		const method = 'POST';
		const canonical_uri = '/v1/speech';

		const payload = JSON.stringify({
			Text: text,
			OutputFormat: 'mp3',
			VoiceId: 'Matthew', // Cheapest standard US male voice
			Engine: 'standard' // Standard engine (cheaper than neural)
		});

		// Get current date for AWS signature
		const now = new Date();
		const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
		const dateStamp = amzDate.substring(0, 8);

		// Create canonical headers
		const canonical_headers = `content-type:application/json\nhost:polly.${region}.amazonaws.com\nx-amz-date:${amzDate}\n`;
		const signed_headers = 'content-type;host;x-amz-date';

		// Create payload hash
		const payloadHash = await sha256(payload);

		// Create canonical request
		const canonical_request = `${method}\n${canonical_uri}\n\n${canonical_headers}\n${signed_headers}\n${payloadHash}`;

		// Create string to sign
		const algorithm = 'AWS4-HMAC-SHA256';
		const credential_scope = `${dateStamp}/${region}/${service}/aws4_request`;
		const canonical_request_hash = await sha256(canonical_request);
		const string_to_sign = `${algorithm}\n${amzDate}\n${credential_scope}\n${canonical_request_hash}`;

		// Calculate signature
		const signing_key = await getSignatureKey(env.AWS_SECRET_ACCESS_KEY, dateStamp, region, service);
		const signature = await hmac(signing_key, string_to_sign);

		// Create authorization header
		const authorization_header = `${algorithm} Credential=${env.AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}`;

		// Make request to Polly
		const response = await fetch(pollyEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Amz-Date': amzDate,
				'Authorization': authorization_header
			},
			body: payload
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Polly API error:', errorText);
			return json({ error: 'TTS generation failed' }, { status: response.status });
		}

		// Get audio stream from Polly
		const audioBuffer = await response.arrayBuffer();

		// Return audio as MP3
		return new Response(audioBuffer, {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Content-Length': audioBuffer.byteLength.toString()
			}
		});
	} catch (error) {
		console.error('TTS error:', error);
		return json({ error: 'TTS request failed' }, { status: 500 });
	}
};

// Helper function to create SHA256 hash
async function sha256(message: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

// Helper function to create HMAC signature
async function hmac(key: ArrayBuffer | string, message: string): Promise<string> {
	const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
	const msgBuffer = new TextEncoder().encode(message);

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyBuffer,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
	return Array.from(new Uint8Array(signature))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

// Helper function to derive AWS signing key
async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
	const kDate = await hmacBuffer(`AWS4${key}`, dateStamp);
	const kRegion = await hmacBuffer(kDate, regionName);
	const kService = await hmacBuffer(kRegion, serviceName);
	const kSigning = await hmacBuffer(kService, 'aws4_request');
	return kSigning;
}

// Helper to get HMAC as buffer for chaining
async function hmacBuffer(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
	const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
	const msgBuffer = new TextEncoder().encode(message);

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyBuffer,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	return await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
}
