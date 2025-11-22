<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	console.log('Login page script loaded', { supabase });

	async function handleEmailLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			error = signInError.message;
			loading = false;
		} else {
			goto('/chat');
		}
	}

	async function handleGoogleLogin() {
		loading = true;
		error = '';

		console.log('Starting Google login...');

		const { data, error: signInError } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/chat`
			}
		});

		console.log('Google login response:', { data, signInError });

		if (signInError) {
			error = signInError.message;
			loading = false;
			console.error('Google login error:', signInError);
		}
	}
</script>

<div class="auth-page">
	<div class="auth-container">
		<a href="/" class="logo">
			<img src="/logo.webp" alt="Chatkin" class="logo-icon" />
			<span>Chatkin</span>
		</a>

		<div class="auth-card">
			<h1>Welcome back</h1>
			<p class="subtitle">Sign in to continue to your workspace</p>

			{#if error}
				<div class="error-message">
					{error}
				</div>
			{/if}

			<form class="auth-form" on:submit={handleEmailLogin}>
				<div class="form-group">
					<label for="email">Email</label>
					<input
						type="email"
						id="email"
						bind:value={email}
						placeholder="you@example.com"
						required
						disabled={loading}
					/>
				</div>

				<div class="form-group">
					<label for="password">Password</label>
					<input
						type="password"
						id="password"
						bind:value={password}
						placeholder="••••••••"
						required
						disabled={loading}
					/>
				</div>

				<button type="submit" class="primary-btn full-width" disabled={loading}>
					{loading ? 'Signing in...' : 'Sign In'}
				</button>
			</form>

			<div class="divider">
				<span>or</span>
			</div>

			<div class="social-auth">
				<button type="button" class="social-btn" on:click={handleGoogleLogin} disabled={loading}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
						<path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
						<path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
						<path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
					</svg>
					Continue with Google
				</button>
			</div>

			<p class="auth-footer">
				Don't have an account? <a href="/signup">Sign up</a>
			</p>
		</div>
	</div>
</div>

<style>
	.auth-page {
		min-height: 100vh;
		background: var(--bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.auth-container {
		width: 100%;
		max-width: 400px;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: center;
		margin-bottom: 32px;
		text-decoration: none;
		color: var(--text-primary);
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.logo-icon {
		width: 64px;
		height: 64px;
		border-radius: 14px;
	}

	.auth-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 32px;
	}

	h1 {
		font-size: 1.75rem;
		margin-bottom: 8px;
		text-align: center;
	}

	.subtitle {
		color: var(--text-secondary);
		text-align: center;
		margin-bottom: 32px;
		font-size: 0.9375rem;
	}

	.error-message {
		padding: 12px 16px;
		background: rgba(211, 47, 47, 0.1);
		border: 1px solid var(--danger);
		border-radius: var(--radius-md);
		color: var(--danger);
		font-size: 0.875rem;
		margin-bottom: 16px;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.full-width {
		width: 100%;
	}

	.divider {
		position: relative;
		text-align: center;
		margin: 24px 0;
	}

	.divider::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		width: 100%;
		height: 1px;
		background: var(--border-color);
	}

	.divider span {
		position: relative;
		background: var(--bg-secondary);
		padding: 0 12px;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.social-auth {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.social-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.social-btn:hover {
		background: var(--bg-tertiary);
		transform: translateY(-1px);
	}

	.social-btn:active {
		transform: translateY(0);
	}

	.auth-footer {
		text-align: center;
		margin-top: 24px;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.auth-footer a {
		color: var(--accent-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.auth-footer a:hover {
		text-decoration: underline;
	}
</style>
