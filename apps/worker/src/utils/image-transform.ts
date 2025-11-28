/**
 * Image transformation utilities using Cloudflare's Image Resizing
 */

export interface ImageTransformOptions {
	width?: number;
	height?: number;
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
	format?: 'auto' | 'webp' | 'avif' | 'json' | 'jpeg' | 'png';
	quality?: number;
	metadata?: 'keep' | 'copyright' | 'none';
}

/**
 * Parse image transformation options from URL path
 * Expected format: /cdn-cgi/image/<options>/<filename>
 * Example: /cdn-cgi/image/width=400,quality=85,format=webp/file.jpg
 */
export function parseImageOptions(optionsString: string): ImageTransformOptions {
	const options: ImageTransformOptions = {};

	const pairs = optionsString.split(',');
	for (const pair of pairs) {
		const [key, value] = pair.split('=');

		switch (key.trim()) {
			case 'width':
			case 'w':
				options.width = parseInt(value);
				break;
			case 'height':
			case 'h':
				options.height = parseInt(value);
				break;
			case 'fit':
				options.fit = value as ImageTransformOptions['fit'];
				break;
			case 'format':
			case 'f':
				options.format = value as ImageTransformOptions['format'];
				break;
			case 'quality':
			case 'q':
				options.quality = parseInt(value);
				break;
			case 'metadata':
				options.metadata = value as ImageTransformOptions['metadata'];
				break;
		}
	}

	return options;
}

/**
 * Build image transformation request options
 */
export function buildTransformOptions(options: ImageTransformOptions): RequestInit {
	const cf: any = {
		image: {
			fit: options.fit || 'scale-down',
			format: options.format || 'auto',
			quality: options.quality || 85,
			metadata: options.metadata || 'none'
		}
	};

	if (options.width) {
		cf.image.width = options.width;
	}

	if (options.height) {
		cf.image.height = options.height;
	}

	return { cf };
}

/**
 * Get default thumbnail options
 */
export function getThumbnailOptions(): ImageTransformOptions {
	return {
		width: 400,
		fit: 'cover',
		format: 'auto', // auto-detects WebP support
		quality: 85,
		metadata: 'none'
	};
}

/**
 * Get default viewer options (larger but still optimized)
 */
export function getViewerOptions(): ImageTransformOptions {
	return {
		width: 1920,
		fit: 'scale-down',
		format: 'auto',
		quality: 90,
		metadata: 'none'
	};
}

/**
 * Generate CDN image URL for frontend
 */
export function getCdnImageUrl(
	baseUrl: string,
	filename: string,
	options: ImageTransformOptions
): string {
	const optParts: string[] = [];

	if (options.width) optParts.push(`w=${options.width}`);
	if (options.height) optParts.push(`h=${options.height}`);
	if (options.fit) optParts.push(`fit=${options.fit}`);
	if (options.format) optParts.push(`f=${options.format}`);
	if (options.quality) optParts.push(`q=${options.quality}`);

	const optsString = optParts.join(',');
	return `${baseUrl}/cdn-cgi/image/${optsString}/${filename}`;
}
