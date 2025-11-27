/**
 * Shared types for Chatkin OS Worker
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CHATKIN_BUCKET: any; // R2Bucket type from Cloudflare Workers
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins
}

export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
}
