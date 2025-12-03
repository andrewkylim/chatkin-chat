<script lang="ts">
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';
	import { page } from '$app/stores';

	$: domain = $page.params.id; // Now it's a domain name, not a project ID

	// Domain AI descriptions
	const domainAIConfig: Record<string, { title: string; subtitle: string; welcome: string }> = {
		Body: {
			title: 'Body AI',
			subtitle: 'Your health and fitness coach',
			welcome: "Hi! I'm your Body AI coach. I can help you manage your health, fitness, nutrition, and physical wellness. What would you like to work on?"
		},
		Mind: {
			title: 'Mind AI',
			subtitle: 'Your mental health guide',
			welcome: "Hi! I'm your Mind AI guide. I can help you with mental health, stress management, mindfulness, and emotional wellbeing. What's on your mind?"
		},
		Purpose: {
			title: 'Purpose AI',
			subtitle: 'Your career and purpose advisor',
			welcome: "Hi! I'm your Purpose AI advisor. I can help you with career goals, life purpose, professional development, and meaningful work. What would you like to explore?"
		},
		Connection: {
			title: 'Connection AI',
			subtitle: 'Your relationships coach',
			welcome: "Hi! I'm your Connection AI coach. I can help you with relationships, social connections, communication, and building meaningful bonds. What would you like to discuss?"
		},
		Growth: {
			title: 'Growth AI',
			subtitle: 'Your personal development mentor',
			welcome: "Hi! I'm your Growth AI mentor. I can help you with personal development, learning, skills, and continuous improvement. What would you like to grow?"
		},
		Finance: {
			title: 'Finance AI',
			subtitle: 'Your financial planning advisor',
			welcome: "Hi! I'm your Finance AI advisor. I can help you with budgeting, financial planning, investments, and money management. What financial goals are you working on?"
		}
	};

	$: domainConfig = domainAIConfig[domain as string] || {
		title: `${domain} Domain`,
		subtitle: `Manage your ${domain} domain`,
		welcome: `Hi! I can help you manage tasks and notes in your ${domain} domain. What would you like to work on?`
	};
</script>

<UnifiedChatPage
	scope="project"
	projectId={domain}
	pageTitle={domainConfig.title}
	pageSubtitle={domainConfig.subtitle}
	welcomeMessage={domainConfig.welcome}
/>
