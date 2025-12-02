<script lang="ts">
	import AppLayout from './AppLayout.svelte';
	import UnifiedChatContent from './UnifiedChatContent.svelte';

	// Re-export all props for pass-through
	export let isEmbedded = false;
	export let scope: 'global' | 'tasks' | 'notes' | 'project' = 'global';
	export let projectId: string | undefined = undefined;
	export let pageTitle: string = 'Chat';
	export let pageIcon: string | undefined = undefined;
	export let pageSubtitle: string | undefined = undefined;
	export let welcomeMessage: string = "Hi! I'm your AI assistant. What would you like to do?";
	export let onOperationsComplete: ((operations: any[]) => Promise<void>) | undefined = undefined;
	export let onDataChange: (() => Promise<void>) | undefined = undefined;
</script>

{#if isEmbedded}
	<UnifiedChatContent
		{scope}
		{projectId}
		{pageTitle}
		{pageIcon}
		{pageSubtitle}
		{welcomeMessage}
		{onOperationsComplete}
		{onDataChange}
		{isEmbedded}
	/>
{:else}
	<AppLayout hideBottomNav={true}>
		<UnifiedChatContent
			{scope}
			{projectId}
			{pageTitle}
			{pageIcon}
			{pageSubtitle}
			{welcomeMessage}
			{onOperationsComplete}
			{onDataChange}
			isEmbedded={false}
		/>
	</AppLayout>
{/if}
