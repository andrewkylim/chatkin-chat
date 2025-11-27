/**
 * Sentry error tracking integration
 */

import { captureException as sentryCapture, setContext } from '@sentry/cloudflare';

/**
 * Capture exception in Sentry
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (context) {
    setContext('additional', context);
  }

  sentryCapture(error);
}
