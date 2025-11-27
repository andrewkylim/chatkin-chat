/**
 * Centralized error handling utility with Sentry integration
 */

import { captureException, captureMessage } from '@sentry/sveltekit';
import { logger } from './logger';

export interface ErrorContext {
	operation?: string;
	component?: string;
	userId?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Handle and report errors with consistent logging and Sentry integration
 */
export function handleError(error: unknown, context?: ErrorContext): void {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const fullContext = {
		...context,
		timestamp: new Date().toISOString()
	};

	// Log to console
	logger.error(
		context?.operation || 'Error occurred',
		error,
		fullContext
	);

	// Report to Sentry with context
	try {
		if (error instanceof Error) {
			captureException(error, {
				contexts: {
					error: fullContext
				},
				tags: {
					operation: context?.operation,
					component: context?.component
				}
			});
		} else {
			captureMessage(errorMessage, {
				level: 'error',
				contexts: {
					error: fullContext
				},
				tags: {
					operation: context?.operation,
					component: context?.component
				}
			});
		}
	} catch (sentryError) {
		// Fallback if Sentry fails
		console.error('Failed to report error to Sentry:', sentryError);
	}
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<unknown>>(
	fn: T,
	context?: ErrorContext
): T {
	return (async (...args: unknown[]) => {
		try {
			return await fn(...args);
		} catch (error) {
			handleError(error, context);
			throw error;
		}
	}) as T;
}

/**
 * Create a safe async function that catches errors and shows user-friendly messages
 */
export async function safeAsync<T>(
	fn: () => Promise<T>,
	options?: {
		context?: ErrorContext;
		fallback?: T;
		showToast?: boolean;
		toastMessage?: string;
	}
): Promise<T | undefined> {
	try {
		return await fn();
	} catch (error) {
		handleError(error, options?.context);

		// TODO: Integrate with toast notification system when available
		if (options?.showToast) {
			console.warn(options.toastMessage || 'An error occurred. Please try again.');
		}

		return options?.fallback;
	}
}

/**
 * Error boundary for database operations
 */
export async function dbOperation<T>(
	operation: () => Promise<T>,
	operationName: string
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		handleError(error, {
			operation: operationName,
			component: 'database'
		});
		throw error;
	}
}

/**
 * Error boundary for API calls
 */
export async function apiCall<T>(
	operation: () => Promise<T>,
	endpoint: string
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		handleError(error, {
			operation: `API call to ${endpoint}`,
			component: 'api'
		});
		throw error;
	}
}
