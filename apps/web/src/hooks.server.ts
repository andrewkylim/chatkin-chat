/**
 * SvelteKit server hooks with Sentry error tracking
 */

import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// Initialize Sentry for server-side error tracking
Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  environment: import.meta.env.DEV ? 'development' : 'production',

  // Performance monitoring
  tracesSampleRate: 0.1, // Sample 10% of transactions
});

// Sequence all hooks
export const handle: Handle = sequence(
  sentryHandle()
);

// Export error handler
export const handleError = handleErrorWithSentry();
