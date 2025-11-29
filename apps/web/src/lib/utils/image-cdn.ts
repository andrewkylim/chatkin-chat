/**
 * Image CDN utilities for generating optimized image URLs
 * Uses Cloudflare Image Resizing for WebP conversion and resizing
 */

import { PUBLIC_WORKER_URL } from '$env/static/public';
import { dev } from '$app/environment';

export interface ImageOptions {
	width?: number;
	height?: number;
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
	format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
	quality?: number;
}

/**
 * Generate CDN image URL with transformations
 * Only applies transformations in production (Cloudflare Image Resizing doesn't work in dev)
 */
export function getCdnImageUrl(fileUrl: string, options: ImageOptions = {}): string {
	// NOTE: Cloudflare Image Resizing doesn't work when the Worker fetches from itself
	// This is a known limitation. For now, we return the original URL.
	// TODO: Consider using Cloudflare Images product or implementing client-side resizing
	return fileUrl;

	/* DISABLED - Cloudflare Image Resizing limitation
	// In development, return original URL (Image Resizing doesn't work locally)
	if (dev) return fileUrl;

	// Extract filename from the file URL
	const filename = fileUrl.split('/api/files/').pop();
	if (!filename) return fileUrl;

	const optParts: string[] = [];

	if (options.width) optParts.push(`w=${options.width}`);
	if (options.height) optParts.push(`h=${options.height}`);
	if (options.fit) optParts.push(`fit=${options.fit}`);
	if (options.format) optParts.push(`f=${options.format}`);
	if (options.quality) optParts.push(`q=${options.quality}`);

	if (optParts.length === 0) return fileUrl;

	const optsString = optParts.join(',');
	return `${PUBLIC_WORKER_URL}/img/${optsString}/${filename}`;
	*/
}

/**
 * Get thumbnail URL (400px, cover fit, auto format, 85% quality)
 */
export function getThumbnailUrl(fileUrl: string): string {
	return getCdnImageUrl(fileUrl, {
		width: 400,
		fit: 'cover',
		format: 'auto',
		quality: 85
	});
}

/**
 * Get viewer URL (1920px, scale-down fit, auto format, 90% quality)
 */
export function getViewerUrl(fileUrl: string): string {
	return getCdnImageUrl(fileUrl, {
		width: 1920,
		fit: 'scale-down',
		format: 'auto',
		quality: 90
	});
}
