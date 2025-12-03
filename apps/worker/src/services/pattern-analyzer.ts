/**
 * Pattern Analyzer Service
 * Detects behavioral patterns across tasks and domains
 * Generates coach observations for proactive coaching
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface CoachObservation {
	observation_type: 'pattern' | 'concern' | 'win' | 'correlation' | 'stuck';
	content: string;
	data_summary: any;
	priority: 'low' | 'medium' | 'high';
}

export interface DomainTrend {
	domain: string;
	tasks_completed_last_7_days: number;
	tasks_completed_last_30_days: number;
	total_completed: number;
	tasks_todo: number;
	tasks_in_progress: number;
	avg_completion_time_days: number | null;
	abandoned_task_count: number;
	stuck_task_count: number;
}

export interface RecurringAdherence {
	domain: string;
	parent_task_id: string;
	recurring_task_title: string;
	times_completed: number;
	completed_last_7_days: number;
	completed_last_30_days: number;
	times_skipped: number;
	last_completed_at: string | null;
	days_since_last_completion: number | null;
}

export class PatternAnalyzer {
	constructor(private supabase: SupabaseClient) {}

	/**
	 * Main analysis function - detects patterns for a user
	 */
	async analyzeUserPatterns(userId: string): Promise<CoachObservation[]> {
		const observations: CoachObservation[] = [];

		try {
			// Load data from database views and tables
			const [tasks, domainTrends, recurringAdherence] = await Promise.all([
				this.loadUserTasks(userId),
				this.loadDomainTrends(userId),
				this.loadRecurringAdherence(userId)
			]);

			// Run pattern detection algorithms
			observations.push(
				...this.detectStuckTasks(tasks),
				...this.detectDomainShutdown(domainTrends),
				...this.detectRecurringFailure(recurringAdherence),
				...this.detectWins(domainTrends),
				...this.detectCorrelations(domainTrends)
			);

			logger.debug('Pattern analysis complete', {
				userId,
				observationsFound: observations.length
			});
		} catch (error) {
			logger.error('Pattern analysis failed', { userId, error });
		}

		return observations;
	}

	/**
	 * Load user tasks with temporal data
	 */
	private async loadUserTasks(userId: string): Promise<any[]> {
		const { data, error } = await this.supabase
			.from('tasks')
			.select(
				`
				id,
				title,
				status,
				priority,
				created_at,
				started_at,
				completed_at,
				project_id,
				projects!inner (
					domain
				)
			`
			)
			.eq('user_id', userId);

		if (error) {
			logger.error('Failed to load tasks', { error });
			return [];
		}

		return data || [];
	}

	/**
	 * Load domain trends from database view
	 */
	private async loadDomainTrends(userId: string): Promise<DomainTrend[]> {
		const { data, error } = await this.supabase
			.from('domain_trends')
			.select('*')
			.eq('user_id', userId);

		if (error) {
			logger.error('Failed to load domain trends', { error });
			return [];
		}

		return data || [];
	}

	/**
	 * Load recurring task adherence from database view
	 */
	private async loadRecurringAdherence(userId: string): Promise<RecurringAdherence[]> {
		const { data, error } = await this.supabase
			.from('recurring_task_adherence')
			.select('*')
			.eq('user_id', userId);

		if (error) {
			logger.error('Failed to load recurring adherence', { error });
			return [];
		}

		return data || [];
	}

	/**
	 * Detect tasks stuck in progress for > 7 days
	 */
	private detectStuckTasks(tasks: any[]): CoachObservation[] {
		const stuckTasks = tasks.filter((t) => {
			if (t.status !== 'in_progress' || !t.started_at) return false;
			const daysInProgress = Math.floor(
				(Date.now() - new Date(t.started_at).getTime()) / (1000 * 60 * 60 * 24)
			);
			return daysInProgress > 7;
		});

		if (stuckTasks.length >= 3) {
			return [
				{
					observation_type: 'stuck',
					content: `You have ${stuckTasks.length} tasks stuck "in progress" for over a week. What's really in the way?`,
					data_summary: {
						task_ids: stuckTasks.map((t) => t.id),
						task_titles: stuckTasks.map((t) => t.title),
						stuck_days: stuckTasks.map((t) =>
							Math.floor(
								(Date.now() - new Date(t.started_at).getTime()) / (1000 * 60 * 60 * 24)
							)
						),
						domains: stuckTasks.map((t) => t.projects.domain)
					},
					priority: 'high'
				}
			];
		}

		return [];
	}

	/**
	 * Detect domain shutdown (no tasks completed in 30 days in a domain)
	 */
	private detectDomainShutdown(domainTrends: DomainTrend[]): CoachObservation[] {
		const observations: CoachObservation[] = [];

		const shutdownDomains = domainTrends.filter(
			(trend) =>
				trend.tasks_completed_last_30_days === 0 &&
				(trend.tasks_todo > 0 || trend.tasks_in_progress > 0)
		);

		if (shutdownDomains.length >= 2) {
			observations.push({
				observation_type: 'concern',
				content: `${shutdownDomains.map((d) => d.domain).join(' and ')} have gone quiet—no tasks completed in a month. What's happening there?`,
				data_summary: {
					domains: shutdownDomains.map((d) => d.domain),
					abandoned_tasks: shutdownDomains.map((d) => d.abandoned_task_count)
				},
				priority: 'high'
			});
		}

		return observations;
	}

	/**
	 * Detect recurring task failures (skipped > 3 times in last 30 days)
	 */
	private detectRecurringFailure(recurringAdherence: RecurringAdherence[]): CoachObservation[] {
		const observations: CoachObservation[] = [];

		const failingRoutines = recurringAdherence.filter(
			(routine) =>
				routine.times_skipped > 3 && routine.days_since_last_completion !== null && routine.days_since_last_completion > 14
		);

		if (failingRoutines.length > 0) {
			const topFailure = failingRoutines[0]; // Most skipped
			observations.push({
				observation_type: 'pattern',
				content: `"${topFailure.recurring_task_title}" has been skipped ${topFailure.times_skipped} times. Is this still relevant, or is something blocking you?`,
				data_summary: {
					task_id: topFailure.parent_task_id,
					task_title: topFailure.recurring_task_title,
					domain: topFailure.domain,
					times_skipped: topFailure.times_skipped,
					days_since_completion: topFailure.days_since_last_completion
				},
				priority: 'medium'
			});
		}

		return observations;
	}

	/**
	 * Detect wins (domain with high completion rate in last 7 days)
	 */
	private detectWins(domainTrends: DomainTrend[]): CoachObservation[] {
		const observations: CoachObservation[] = [];

		const winningDomains = domainTrends.filter(
			(trend) => trend.tasks_completed_last_7_days >= 5
		);

		if (winningDomains.length > 0) {
			const topDomain = winningDomains.sort(
				(a, b) => b.tasks_completed_last_7_days - a.tasks_completed_last_7_days
			)[0];

			observations.push({
				observation_type: 'win',
				content: `${topDomain.domain} is on fire—${topDomain.tasks_completed_last_7_days} tasks completed this week. What's working there?`,
				data_summary: {
					domain: topDomain.domain,
					tasks_completed_7d: topDomain.tasks_completed_last_7_days,
					tasks_completed_30d: topDomain.tasks_completed_last_30_days
				},
				priority: 'low'
			});
		}

		return observations;
	}

	/**
	 * Detect correlations (one domain thriving while another tanks)
	 */
	private detectCorrelations(domainTrends: DomainTrend[]): CoachObservation[] {
		const observations: CoachObservation[] = [];

		// Find thriving domain (high completion) and struggling domain (high abandoned)
		const thrivingDomain = domainTrends
			.filter((d) => d.tasks_completed_last_30_days >= 10)
			.sort((a, b) => b.tasks_completed_last_30_days - a.tasks_completed_last_30_days)[0];

		const strugglingDomain = domainTrends
			.filter((d) => d.abandoned_task_count >= 5)
			.sort((a, b) => b.abandoned_task_count - a.abandoned_task_count)[0];

		if (
			thrivingDomain &&
			strugglingDomain &&
			thrivingDomain.domain !== strugglingDomain.domain
		) {
			observations.push({
				observation_type: 'correlation',
				content: `${thrivingDomain.domain} is thriving (${thrivingDomain.tasks_completed_last_30_days} tasks done) while ${strugglingDomain.domain} is stalling (${strugglingDomain.abandoned_task_count} abandoned). Is one domain eating the other?`,
				data_summary: {
					thriving_domain: thrivingDomain.domain,
					thriving_completed: thrivingDomain.tasks_completed_last_30_days,
					struggling_domain: strugglingDomain.domain,
					struggling_abandoned: strugglingDomain.abandoned_task_count
				},
				priority: 'medium'
			});
		}

		return observations;
	}
}

/**
 * Factory function
 */
export function createPatternAnalyzer(supabase: SupabaseClient): PatternAnalyzer {
	return new PatternAnalyzer(supabase);
}
