<script lang="ts">
	import type { AssessmentResults } from '$lib/db/assessment';

	let { results }: { results: AssessmentResults | null } = $props();

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	};

	const formatOverviewContent = (text: string) => {
		// Split by double newlines to get paragraphs
		const paragraphs = text.split('\n\n').filter(p => p.trim());

		return paragraphs.map(para => {
			const lines = para.split('\n').map(line => line.trim()).filter(line => line);

			// Check if this is a section header (Key Strengths or Primary Growth)
			if (lines[0].includes('Key Strengths') || lines[0].includes('Primary Growth')) {
				const header = lines[0].replace(':', '');
				const items = lines.slice(1);

				return `<div class="insight-section">
					<h4 class="section-title">${header}</h4>
					<ul class="insight-list">
						${items.map(item => `<li>${item.replace(/^-\s*/, '')}</li>`).join('')}
					</ul>
				</div>`;
			}

			// Regular paragraph
			return `<p>${para}</p>`;
		}).join('');
	};

	const extractOverviewSection = (report: string | null) => {
		if (!report) return null;
		// Extract the "Overall Assessment & Key Insights" section from the AI report
		const overviewMatch = report.match(/## Overall Assessment & Key Insights\s+([\s\S]*?)(?=\n##|$)/);
		if (overviewMatch) {
			// Clean up the extracted text - remove markdown formatting and extra whitespace
			let text = overviewMatch[1].trim();
			// Remove ** markdown bold markers
			text = text.replace(/\*\*/g, '');
			// Remove trailing --- markers
			text = text.replace(/\n*---\s*$/g, '');
			// Replace multiple newlines with double newlines
			text = text.replace(/\n{3,}/g, '\n\n');
			return text;
		}
		return null;
	};
</script>

{#if results}
	<div class="profile-summary-banner">
		<div class="banner-header">
			<div class="header-left">
				<div class="banner-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 3v18h18"/>
						<path d="M18 17V9"/>
						<path d="M13 17V5"/>
						<path d="M8 17v-3"/>
					</svg>
				</div>
				<div class="header-text">
					<h3>Report Summary</h3>
					<p class="header-subtitle">Your assessment overview</p>
				</div>
			</div>
		</div>
		<div class="banner-text">
			<div class="summary-content">
				{@const overviewText = extractOverviewSection(results.ai_report)}
				{#if overviewText}
					{@html formatOverviewContent(overviewText)}
				{:else}
					<p>Your wellness assessment is complete with scores across 6 domains. Last updated {formatDate(results.completed_at)}.</p>
				{/if}
			</div>
		</div>
		<div class="banner-footer">
			<a href="/profile" class="view-report-btn">
				<span>View Full Report</span>
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M6 4l4 4-4 4" />
				</svg>
			</a>
		</div>
	</div>
{:else}
	<a href="/questionnaire" class="profile-summary-banner incomplete">
		<div class="banner-content">
			<div class="banner-icon">📊</div>
			<div class="banner-text">
				<h3>Complete Your Wellness Assessment</h3>
				<p>Get personalized insights and domain scores</p>
			</div>
		</div>
		<div class="banner-action">
			<span>Start Assessment</span>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M6 4l4 4-4 4" />
			</svg>
		</div>
	</a>
{/if}

<style>
	.profile-summary-banner {
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		margin-bottom: 32px;
		overflow: hidden;
	}

	.banner-header {
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-tertiary);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.banner-icon {
		width: 44px;
		height: 44px;
		background: var(--accent-primary);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: white;
	}

	.header-text {
		flex: 1;
	}

	.banner-header h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 2px 0;
		color: var(--text-primary);
	}

	.header-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.banner-text {
		padding: 24px;
	}

	.summary-content {
		font-size: 0.9375rem;
		color: var(--text-secondary);
		line-height: 1.8;
	}

	.summary-content :global(p) {
		margin: 0 0 1.25rem 0;
	}

	.summary-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.summary-content :global(.insight-section) {
		margin: 1.5rem 0;
		padding: 16px 20px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--accent-primary);
	}

	.summary-content :global(.insight-section:first-child) {
		margin-top: 1rem;
	}

	.summary-content :global(.section-title) {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 12px 0;
	}

	.summary-content :global(.insight-list) {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.summary-content :global(.insight-list li) {
		padding: 6px 0 6px 20px;
		position: relative;
		line-height: 1.6;
	}

	.summary-content :global(.insight-list li:before) {
		content: '•';
		position: absolute;
		left: 8px;
		color: var(--accent-primary);
		font-weight: bold;
		font-size: 1.2rem;
	}

	.banner-footer {
		padding: 16px 24px;
		border-top: 1px solid var(--border-color);
		background: var(--bg-tertiary);
		display: flex;
		justify-content: flex-end;
	}

	.view-report-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		background: var(--accent-primary);
		color: white;
		font-weight: 600;
		font-size: 0.9375rem;
		text-decoration: none;
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
	}

	.view-report-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(199, 124, 92, 0.25);
	}

	.view-report-btn:active {
		transform: translateY(0);
	}

	.profile-summary-banner.incomplete {
		background: linear-gradient(
			135deg,
			rgba(199, 124, 92, 0.05) 0%,
			rgba(199, 124, 92, 0.1) 100%
		);
	}

	@media (max-width: 768px) {
		.banner-header {
			padding: 16px 20px;
		}

		.banner-icon {
			width: 40px;
			height: 40px;
		}

		.banner-icon svg {
			width: 20px;
			height: 20px;
		}

		.banner-header h3 {
			font-size: 1rem;
		}

		.header-subtitle {
			font-size: 0.75rem;
		}

		.banner-text {
			padding: 20px;
		}

		.summary-content {
			font-size: 0.875rem;
		}

		.summary-content :global(.insight-section) {
			padding: 14px 16px;
			margin: 1.25rem 0;
		}

		.summary-content :global(.section-title) {
			font-size: 0.9375rem;
		}

		.banner-footer {
			padding: 14px 20px;
		}

		.view-report-btn {
			font-size: 0.875rem;
			padding: 9px 16px;
		}
	}

	@media (max-width: 480px) {
		.banner-header {
			padding: 14px 16px;
		}

		.banner-text {
			padding: 16px;
		}

		.banner-footer {
			padding: 12px 16px;
		}

		.view-report-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
