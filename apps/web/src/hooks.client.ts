/**
 * SvelteKit client hooks with Sentry error tracking
 */

import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';

// Initialize Sentry only if DSN is provided
if (import.meta.env.PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.PUBLIC_SENTRY_DSN,
    environment: import.meta.env.DEV ? 'development' : 'production',

    // Performance monitoring
    tracesSampleRate: 0.1, // Sample 10% of transactions

    // Session replay
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors

    integrations: [
      replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

// Export error handler
export const handleError = import.meta.env.PUBLIC_SENTRY_DSN
  ? handleErrorWithSentry()
  : ({ error }: { error: unknown }) => {
      console.error(error);
    };
