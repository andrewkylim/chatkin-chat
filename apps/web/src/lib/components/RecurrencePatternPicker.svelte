<script lang="ts">
	import type { RecurrencePattern } from '@chatkin/types';

	export let pattern: RecurrencePattern = {
		frequency: 'daily',
		interval: 1
	};

	let frequency: RecurrencePattern['frequency'] = pattern.frequency || 'daily';
	let interval: number = pattern.interval || 1;
	let selectedDays: number[] = pattern.days_of_week || [];
	let dayOfMonth: number = pattern.day_of_month || 1;
	let monthOfYear: number = pattern.month_of_year || 1;

	$: {
		// Update pattern whenever any value changes
		pattern = {
			frequency,
			interval,
			...(frequency === 'weekly' && selectedDays.length > 0 && { days_of_week: selectedDays }),
			...(frequency === 'monthly' && { day_of_month: dayOfMonth }),
			...(frequency === 'yearly' && { month_of_year: monthOfYear, day_of_month: dayOfMonth })
		};
	}

	function toggleDay(day: number) {
		if (selectedDays.includes(day)) {
			selectedDays = selectedDays.filter(d => d !== day);
		} else {
			selectedDays = [...selectedDays, day].sort((a, b) => a - b);
		}
	}

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
</script>

<div class="recurrence-picker">
	<!-- Frequency Selection -->
	<div class="form-group">
		<label for="frequency">Repeats</label>
		<select id="frequency" bind:value={frequency}>
			<option value="daily">Daily</option>
			<option value="weekly">Weekly</option>
			<option value="monthly">Monthly</option>
			<option value="yearly">Yearly</option>
		</select>
	</div>

	<!-- Interval -->
	<div class="form-group">
		<label for="interval">Every</label>
		<div class="interval-input">
			<button
				type="button"
				class="interval-btn"
				onclick={() => interval = Math.max(1, interval - 1)}
				aria-label="Decrease"
			>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M2 6h8" />
				</svg>
			</button>
			<input
				type="number"
				id="interval"
				bind:value={interval}
				min="1"
				max="365"
			/>
			<button
				type="button"
				class="interval-btn"
				onclick={() => interval = Math.min(365, interval + 1)}
				aria-label="Increase"
			>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 2v8M2 6h8" />
				</svg>
			</button>
			<span class="interval-label">
				{#if frequency === 'daily'}
					{interval === 1 ? 'day' : 'days'}
				{:else if frequency === 'weekly'}
					{interval === 1 ? 'week' : 'weeks'}
				{:else if frequency === 'monthly'}
					{interval === 1 ? 'month' : 'months'}
				{:else if frequency === 'yearly'}
					{interval === 1 ? 'year' : 'years'}
				{/if}
			</span>
		</div>
	</div>

	<!-- Weekly: Days of Week -->
	{#if frequency === 'weekly'}
		<div class="form-group">
			<label>On days</label>
			<div class="day-selector">
				{#each dayNames as day, index}
					<button
						type="button"
						class="day-btn"
						class:selected={selectedDays.includes(index)}
						onclick={() => toggleDay(index)}
					>
						{day}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Monthly: Day of Month -->
	{#if frequency === 'monthly'}
		<div class="form-group">
			<label for="day-of-month">On day</label>
			<input
				type="number"
				id="day-of-month"
				bind:value={dayOfMonth}
				min="1"
				max="31"
			/>
		</div>
	{/if}

	<!-- Yearly: Month and Day -->
	{#if frequency === 'yearly'}
		<div class="form-group">
			<label for="month">In month</label>
			<select id="month" bind:value={monthOfYear}>
				{#each monthNames as month, index}
					<option value={index + 1}>{month}</option>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="year-day">On day</label>
			<input
				type="number"
				id="year-day"
				bind:value={dayOfMonth}
				min="1"
				max="31"
			/>
		</div>
	{/if}
</div>

<style>
	.recurrence-picker {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	select,
	input[type='number'] {
		padding: 8px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	select {
		cursor: pointer;
		padding-right: 32px;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
		background-color: var(--bg-secondary);
	}

	.interval-input {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.interval-input input {
		width: 70px;
		padding: 10px 12px;
		font-size: 0.9375rem;
		height: 44px;
		text-align: center;
		-moz-appearance: textfield;
	}

	/* Hide native number input spinners */
	.interval-input input::-webkit-inner-spin-button,
	.interval-input input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.interval-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.interval-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.interval-btn:active {
		transform: scale(0.95);
	}

	.interval-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.day-selector {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.day-btn {
		padding: 8px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 50px;
	}

	.day-btn:hover {
		border-color: var(--accent-primary);
		color: var(--text-primary);
	}

	.day-btn.selected {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.day-btn {
			min-width: 45px;
			padding: 6px 8px;
			font-size: 0.8125rem;
		}
	}
</style>
