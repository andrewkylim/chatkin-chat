<script lang="ts">
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getProject } from '$lib/db/projects';
	import type { Project } from '@chatkin/types';

	$: projectId = $page.params.id;

	let project: Project | null = null;

	onMount(async () => {
		if (projectId) {
			project = await getProject(projectId);
		}
	});

	$: welcomeMessage = project
		? `🎯 Hi! I can help you manage tasks and notes for Project ${project.name}.\n\nWhat would you like to work on?`
		: "🎯 Hi! I can help you manage tasks and notes for this project.\n\nWhat would you like to work on?";

	$: pageSubtitle = project ? project.name : undefined;
</script>

<UnifiedChatPage
	scope="project"
	{projectId}
	pageTitle="Projects AI"
	{pageSubtitle}
	{welcomeMessage}
/>
