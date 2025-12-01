<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import EditProjectModal from '$lib/components/EditProjectModal.svelte';
	import TaskEditModal from '$lib/components/TaskEditModal.svelte';
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { getProject, getProjects } from '$lib/db/projects';
	import { getTasks, updateTask, deleteTask, createTask } from '$lib/db/tasks';
	import { getNotes, createNote } from '$lib/db/notes';
	import { getFiles, createFile } from '$lib/db/files';
	import type { Project, Task, Note, File } from '@chatkin/types';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { useProjectTasks } from '$lib/logic/useProjectTasks';
	import { useProjectNotes } from '$lib/logic/useProjectNotes';
	import { useProjectActions } from '$lib/logic/useProjectActions';
	import { handleError } from '$lib/utils/error-handler';
	import { getThumbnailUrl } from '$lib/utils/image-cdn';
	import { supabase } from '$lib/supabase';

	$: projectId = $page.params.id;

	let project: Project | null = null;
	let tasks: Task[] = [];
	let notes: Note[] = [];
	let files: File[] = [];
	let loading = true;
	let showMenu = false;
	let showDeleteConfirm = false;
	let showEditModal = false;
	let projects: Project[] = [];
	let showEditTaskModal = false;
	let editingTask: Task | null = null;
	let showCompletedTasks = false;
	let showFabMenu = false;
	let showNewItemMenu = false;
	let showNewTaskModal = false;
	let showNewNoteModal = false;
	let showFileUploadModal = false;
	let fileInput: HTMLInputElement;
	let isDragging = false;
	let dragCounter = 0;
	let isUploading = false;
	let uploadProgress = 0;
	let newTaskTitle = '';
	let newTaskDescription = '';
	let newTaskPriority: 'low' | 'medium' | 'high' = 'medium';
	let newTaskDueDate = '';
	let newNoteTitle = '';
	let newNoteContent = '';

	// Get utilities and actions from helper modules
	const taskHelpers = useProjectTasks();
	const noteHelpers = useProjectNotes();
	const { deleteProject, toggleTaskComplete } = useProjectActions();

	// Destructure for convenience
	const { truncateTitle, formatDueDate, categorizeTasks } = taskHelpers;
	const { formatDate, getContentPreview, getWordCount } = noteHelpers;

	// Close menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (showMenu && !target.closest('.menu-container')) {
			showMenu = false;
		}
		if (showNewItemMenu && !target.closest('.new-item-container')) {
			showNewItemMenu = false;
		}
	}

	onMount(async () => {
		// Lock viewport to prevent elastic scroll on mobile
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = 'hidden';
			document.body.style.overflow = 'hidden';
			document.documentElement.style.overscrollBehavior = 'none';
			document.body.style.overscrollBehavior = 'none';
		}

		await loadData();

		// Load completed tasks preference from localStorage
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('showCompletedTasks');
			// Only restore "show completed" if there are no active tasks
			// Otherwise, default to showing active tasks
			const hasActiveTasks = tasks.some(t => t.status !== 'completed');
			if (saved === 'true' && !hasActiveTasks) {
				showCompletedTasks = true;
			} else {
				showCompletedTasks = false;
			}
		}

		// Setup click-outside handler for menu
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		// Restore default overflow behavior
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
			document.documentElement.style.overscrollBehavior = '';
			document.body.style.overscrollBehavior = '';
		}
	});

	async function loadData() {
		loading = true;
		try {
			[project, tasks, notes, files, projects] = await Promise.all([
				getProject(projectId),
				getTasks().then(allTasks => allTasks.filter(t => t.project_id === projectId)),
				getNotes().then(allNotes => allNotes.filter(n => n.project_id === projectId)),
				getFiles().then(allFiles => allFiles.filter(f => f.project_id === projectId)),
				getProjects()
			]);
		} catch (error) {
			handleError(error, { operation: 'Load project data', component: 'ProjectChatPage' });
		} finally {
			loading = false;
		}
	}

	async function handleDeleteProject() {
		try {
			await deleteProject(projectId);
			goto('/projects');
		} catch (error) {
			handleError(error, { operation: 'Delete project', component: 'ProjectChatPage' });
			alert('Failed to delete project');
		}
	}

	function startEditProject() {
		if (!project) return;
		showMenu = false;
		showEditModal = true;
	}

	function handleCloseEditModal() {
		showEditModal = false;
	}

	async function handleProjectUpdated() {
		// Reload project data
		project = await getProject(projectId);
	}

	async function handleToggleTask(taskId: string, currentStatus: string) {
		try {
			const completed = currentStatus !== 'completed';
			await toggleTaskComplete(taskId, completed);
			await loadData();
		} catch {
			// Error already handled by action
		}
	}

	function toggleShowCompleted() {
		showCompletedTasks = !showCompletedTasks;
		localStorage.setItem('showCompletedTasks', String(showCompletedTasks));
	}

	function openTaskDetail(task: Task) {
		editingTask = task;
		showEditTaskModal = true;
	}

	async function handleUpdateTask(updatedTask: Partial<Task>) {
		if (!editingTask) return;

		try {
			await updateTask(editingTask.id, updatedTask);
			showEditTaskModal = false;
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Update task', component: 'ProjectChatPage' });
			alert('Failed to update task');
		}
	}

	async function handleDeleteTask() {
		if (!editingTask || !confirm('Are you sure you want to delete this task?')) return;

		try {
			await deleteTask(editingTask.id);
			showEditTaskModal = false;
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Delete task', component: 'ProjectChatPage' });
			alert('Failed to delete task');
		}
	}

	async function handleCreateTask() {
		if (!newTaskTitle.trim()) return;

		try {
			await createTask({
				title: newTaskTitle,
				description: newTaskDescription,
				priority: newTaskPriority,
				status: 'todo',
				project_id: projectId,
				due_date: newTaskDueDate || null
			});

			// Reset form
			newTaskTitle = '';
			newTaskDescription = '';
			newTaskPriority = 'medium';
			newTaskDueDate = '';
			showNewTaskModal = false;
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Create task', component: 'ProjectChatPage' });
			alert('Failed to create task');
		}
	}

	async function handleCreateNote() {
		try {
			await createNote({
				title: newNoteTitle.trim() || 'Untitled',
				content: newNoteContent,
				project_id: projectId
			});

			// Reset form
			newNoteTitle = '';
			newNoteContent = '';
			showNewNoteModal = false;
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Create note', component: 'ProjectChatPage' });
			alert('Failed to create note');
		}
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		await uploadFile(file);
		target.value = '';
	}

	async function uploadFile(file: globalThis.File) {
		isUploading = true;
		uploadProgress = 0;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const { data: { session } } = await supabase.auth.getSession();
			if (!session) {
				alert('Please log in to upload files');
				return;
			}

			const workerUrl = PUBLIC_WORKER_URL.replace(/\/$/, '');
			const response = await fetch(`${workerUrl}/api/upload`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${session.access_token}`
				},
				body: formData,
			});

			if (!response.ok) throw new Error('Upload failed');

			const result = await response.json();

		// Create file record in database
		if (result.success && result.file) {
			await createFile({
				filename: result.file.originalName,
				r2_key: result.file.name,
				r2_url: result.file.url,
				mime_type: result.file.type,
				size_bytes: result.file.size,
				note_id: null,
				conversation_id: null,
				message_id: null,
				project_id: projectId,
				is_hidden_from_library: false,
				title: result.file.title || null,
				description: result.file.description || null,
				ai_generated_metadata: !!(result.file.title || result.file.description),
			});
		}

			showFileUploadModal = false;
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Upload file', component: 'ProjectChatPage' });
			alert('Failed to upload file');
		} finally {
			isUploading = false;
			uploadProgress = 0;
		}
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		dragCounter++;
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragCounter--;
		if (dragCounter === 0) {
			isDragging = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		dragCounter = 0;

		const file = e.dataTransfer?.files[0];
		if (!file) return;

		await uploadFile(file);
	}

	$: categorized = categorizeTasks(tasks);
	$: todayTasks = categorized.todayTasks;
	$: thisWeekTasks = categorized.thisWeekTasks;
	$: laterTasks = categorized.laterTasks;
	$: completedTasks = categorized.completedTasks;
</script>

<AppLayout>
<div class="project-chat-page">
	<div class="project-container">
		<!-- Project Content Section (Tasks & Notes) -->
		<div class="content-section">
			<header class="section-header">
				<a href="/projects" class="back-btn">
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M14 2l-8 8 8 8"/>
					</svg>
				</a>
				<div class="header-actions">
					<!-- New Item Button with Dropdown -->
					<div class="new-item-container">
						<button class="new-item-btn" onclick={() => showNewItemMenu = !showNewItemMenu}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<path d="M12 5v14M5 12h14"/>
							</svg>
							<span>New Item</span>
						</button>

						{#if showNewItemMenu}
							<div class="new-item-dropdown">
								<button class="dropdown-item" onclick={() => { showNewTaskModal = true; showNewItemMenu = false; }}>
									<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M9 11l3 3L22 4"/>
										<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
									</svg>
									<span>New Task</span>
								</button>
								<button class="dropdown-item" onclick={() => { showNewNoteModal = true; showNewItemMenu = false; }}>
									<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M15 3l2 2-9 9-4 1 1-4 9-9z"/>
									</svg>
									<span>New Note</span>
								</button>
								<button class="dropdown-item" onclick={() => { showFileUploadModal = true; showNewItemMenu = false; }}>
									<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M13 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-3-5z"/>
										<path d="M13 2v5h3"/>
									</svg>
									<span>New File</span>
								</button>
							</div>
						{/if}
					</div>

					<div class="menu-container">
						<button class="icon-btn" title="Project menu" onclick={() => showMenu = !showMenu}>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
								<circle cx="10" cy="10" r="1.5"/>
								<circle cx="4" cy="10" r="1.5"/>
								<circle cx="16" cy="10" r="1.5"/>
							</svg>
						</button>
						{#if showMenu}
							<div class="dropdown-menu">
								<button class="menu-item" onclick={startEditProject}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11.5 2l2.5 2.5L6 12.5H3.5V10L11.5 2z"/>
									</svg>
									Edit Project
								</button>
								<button class="menu-item delete-item" onclick={() => { showMenu = false; showDeleteConfirm = true; }}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M2 4h12M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4"/>
									</svg>
									Delete Project
								</button>
							</div>
						{/if}
					</div>
				</div>
			</header>

			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading project...</p>
				</div>
			{:else}
				{#if project}
					<div class="project-title-wrapper">
						<span class="project-icon-title">{project.color || '📁'}</span>
						<h1 class="project-title">{project.name}</h1>
					</div>
				{/if}

				{#if tasks.length === 0 && notes.length === 0 && files.length === 0}
					<div class="empty-state">
						<div class="project-icon-large">{project?.color || '📁'}</div>
						<h2>No tasks, notes, or files yet</h2>
						<p>Create tasks, notes, or upload files to get started</p>
					</div>
				{:else}
					<div class="content-list">

					{#if tasks.length > 0}
						{#if !showCompletedTasks || completedTasks.length === 0}
							<!-- Today Section -->
							{#if todayTasks.length > 0 || (todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0)}
								<div class="task-group">
									<div class="group-header">
										<h2 class="group-title">Today</h2>
										{#if completedTasks.length > 0}
											<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed</button>
										{/if}
									</div>
									{#each todayTasks as task (task.id)}
										<div class="task-item">
											<input
												type="checkbox"
												class="task-checkbox"
												id={task.id}
												checked={false}
												onchange={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content" onclick={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title" title={task.title}>{task.title}</span>
												</div>
												<div class="task-meta">
													<span class="priority {task.priority}">{task.priority}</span>
													<span class="task-time">{formatDueDate(task.due_date)}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<!-- This Week Section -->
							{#if thisWeekTasks.length > 0}
								<div class="task-group">
									<div class="group-header">
										<h2 class="group-title">This Week</h2>
										{#if completedTasks.length > 0 && todayTasks.length === 0}
											<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed</button>
										{/if}
									</div>
									{#each thisWeekTasks as task (task.id)}
										<div class="task-item">
											<input
												type="checkbox"
												class="task-checkbox"
												id={task.id}
												checked={false}
												onchange={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content" onclick={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title" title={task.title}>{task.title}</span>
												</div>
												<div class="task-meta">
													<span class="priority {task.priority}">{task.priority}</span>
													<span class="task-time">{formatDueDate(task.due_date)}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Later Section -->
							{#if laterTasks.length > 0}
								<div class="task-group">
									<div class="group-header">
										<h2 class="group-title">Later</h2>
										{#if completedTasks.length > 0 && todayTasks.length === 0 && thisWeekTasks.length === 0}
											<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed</button>
										{/if}
									</div>
									{#each laterTasks as task (task.id)}
										<div class="task-item">
											<input
												type="checkbox"
												class="task-checkbox"
												id={task.id}
												checked={false}
												onchange={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content" onclick={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title" title={task.title}>{task.title}</span>
												</div>
												<div class="task-meta">
													<span class="priority {task.priority}">{task.priority}</span>
													<span class="task-time">{formatDueDate(task.due_date)}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

					<!-- Fallback when all tasks are completed -->
					{#if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0}
						<div class="empty-state">
							<div class="project-icon-large">✅</div>
							<h2>All tasks completed!</h2>
							<p>Great work! You've completed all your tasks.</p>
							<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed Tasks</button>
						</div>
					{/if}
						{:else}
							<!-- Completed Tasks -->
							{#if completedTasks.length > 0}
								<div class="task-group">
									<div class="group-header">
										<h2 class="group-title">Completed</h2>
										<button class="toggle-link" onclick={toggleShowCompleted}>Show All Tasks</button>
									</div>
									{#each completedTasks as task (task.id)}
										<div class="task-item">
											<input
												type="checkbox"
												class="task-checkbox"
												id={task.id}
												checked={true}
												onchange={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content completed" onclick={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title" title={task.title}>{task.title}</span>
												</div>
												<div class="task-meta">
													<span class="task-time">Completed</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<!-- Fallback for when in completed mode but no completed tasks -->
								<div class="empty-state">
									<div class="project-icon-large">📝</div>
									<h2>No completed tasks</h2>
									<p>You haven't completed any tasks yet.</p>
									<button class="toggle-link" onclick={toggleShowCompleted}>Show Active Tasks</button>
								</div>
							{/if}
						{/if}
					{/if}

					<!-- Notes -->
					{#if notes.length > 0}
						<div class="content-group">
							<h2 class="group-title">Notes</h2>
							{#each notes as note (note.id)}
								<a href="/notes/{note.id}" class="note-card">
									<div class="note-header">
										<h3>{truncateTitle(note.title, 50)}</h3>
									</div>
									<p class="note-preview">{getContentPreview(note)}</p>
									<div class="note-footer">
										<span class="note-date">{formatDate(note.updated_at)}</span>
										<span class="note-meta">{getWordCount(note)} words</span>
									</div>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Files -->
					{#if files.length > 0}
						<div class="content-group">
							<h2 class="group-title">Files</h2>
							<div class="files-grid">
								{#each files as file (file.id)}
									<a href="/files?file={file.id}" class="file-card-compact">
										{#if file.mime_type.startsWith('image/')}
											<img src={file.r2_url} alt={file.title || file.filename} class="file-thumbnail" />
										{:else}
											<div class="file-icon-compact">
												<svg width="32" height="32" viewBox="0 0 48 48" fill="currentColor">
													<path d="M14 2H34L42 10V46H6V2H14ZM32 4V12H40M10 20H38M10 28H38M10 36H28" />
												</svg>
											</div>
										{/if}
										<div class="file-info-compact">
											<p class="file-name">{file.title || file.filename}</p>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
			{/if}
		</div>

		<!-- Chat Section -->
		<div class="chat-section">
			<UnifiedChatPage
				scope="project"
				{projectId}
				pageTitle="Projects AI"
				pageIcon="/projects.webp"
				pageSubtitle="Plan and organize your project"
				welcomeMessage="Hi! I can help you manage tasks and notes for this project. What would you like to work on?"
				onDataChange={loadData}
				isEmbedded={true}
			/>
		</div>
	</div>

	<!-- Mobile Layout -->
	<div class="mobile-content">
		<header class="mobile-header">
			<div class="mobile-header-left">
				<a href="/chat" class="mobile-logo-button">
					<img src="/logo.webp" alt="Chatkin" class="mobile-logo" />
				</a>
				<a href="/projects" class="back-btn">
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M14 2l-8 8 8 8"/>
					</svg>
				</a>
				{#if project}
					<div class="project-info-mobile">
					</div>
				{/if}
			</div>
			<div class="mobile-header-actions">
				<div class="menu-container">
					<button class="icon-btn" title="Project menu" onclick={() => showMenu = !showMenu}>
						<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
							<circle cx="10" cy="10" r="1.5"/>
							<circle cx="4" cy="10" r="1.5"/>
							<circle cx="16" cy="10" r="1.5"/>
						</svg>
					</button>
					{#if showMenu}
						<div class="dropdown-menu">
							<button class="menu-item" onclick={startEditProject}>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M11.5 2l2.5 2.5L6 12.5H3.5V10L11.5 2z"/>
								</svg>
								Edit Project
							</button>
							<button class="menu-item delete-item" onclick={() => { showMenu = false; showDeleteConfirm = true; }}>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M2 4h12M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4"/>
								</svg>
								Delete Project
							</button>
						</div>
					{/if}
				</div>
				<MobileUserMenu />
			</div>
		</header>

		<div class="mobile-content-area">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading project...</p>
				</div>
			{:else}
				{#if project}
					<div class="project-title-wrapper mobile">
						<span class="project-icon-title">{project.color || '📁'}</span>
						<h1 class="project-title mobile">{project.name}</h1>
					</div>
				{/if}

				{#if tasks.length === 0 && notes.length === 0 && files.length === 0}
					<div class="empty-state">
						<div class="project-icon-large">{project?.color || '📁'}</div>
						<h2>No tasks, notes, or files yet</h2>
						<p>Create tasks, notes, or upload files to get started</p>
					</div>
				{:else}
				<!-- Tasks Section -->
				{#if tasks.length > 0}
					{#if !showCompletedTasks || completedTasks.length === 0}
						<!-- Today Section -->
						{#if todayTasks.length > 0 || (todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0)}
							<div class="task-group">
								<div class="group-header">
									<h2 class="group-title">Today</h2>
									{#if completedTasks.length > 0}
										<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed</button>
									{/if}
								</div>
								{#each todayTasks as task (task.id)}
									<div class="task-item">
										<input
											type="checkbox"
											class="task-checkbox"
											id={task.id}
											checked={false}
											onchange={() => handleToggleTask(task.id, task.status)}
										/>
										<div class="task-content" onclick={() => openTaskDetail(task)}>
											<div class="task-main">
												<span class="task-title">{truncateTitle(task.title)}</span>
											</div>
											<div class="task-meta">
												<span class="priority {task.priority}">{task.priority}</span>
												<span class="task-time">{formatDueDate(task.due_date)}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- This Week Section -->
						{#if thisWeekTasks.length > 0}
							<div class="task-group">
								<div class="group-header">
									<h2 class="group-title">This Week</h2>
									{#if completedTasks.length > 0 && todayTasks.length === 0}
										<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed</button>
									{/if}
								</div>
								{#each thisWeekTasks as task (task.id)}
									<div class="task-item">
										<input
											type="checkbox"
											class="task-checkbox"
											id={task.id}
											checked={false}
											onchange={() => handleToggleTask(task.id, task.status)}
										/>
										<div class="task-content" onclick={() => openTaskDetail(task)}>
											<div class="task-main">
												<span class="task-title">{truncateTitle(task.title)}</span>
											</div>
											<div class="task-meta">
												<span class="priority {task.priority}">{task.priority}</span>
												<span class="task-time">{formatDueDate(task.due_date)}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Later Section -->
						{#if laterTasks.length > 0}
							<div class="task-group">
								<div class="group-header">
									<h2 class="group-title">Later</h2>
									{#if completedTasks.length > 0 && todayTasks.length === 0 && thisWeekTasks.length === 0}
										<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed</button>
									{/if}
								</div>
								{#each laterTasks as task (task.id)}
									<div class="task-item">
										<input
											type="checkbox"
											class="task-checkbox"
											id={task.id}
											checked={false}
											onchange={() => handleToggleTask(task.id, task.status)}
										/>
										<div class="task-content" onclick={() => openTaskDetail(task)}>
											<div class="task-main">
												<span class="task-title">{truncateTitle(task.title)}</span>
											</div>
											<div class="task-meta">
												<span class="priority {task.priority}">{task.priority}</span>
												<span class="task-time">{formatDueDate(task.due_date)}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

				<!-- Fallback when all tasks are completed -->
				{#if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0}
					<div class="empty-state">
						<div class="project-icon-large">✅</div>
						<h2>All tasks completed!</h2>
						<p>Great work! You've completed all your tasks.</p>
						<button class="toggle-link" onclick={toggleShowCompleted}>Show Completed Tasks</button>
					</div>
				{/if}
						{:else}
							<!-- Completed Tasks -->
							{#if completedTasks.length > 0}
								<div class="task-group">
									<div class="group-header">
										<h2 class="group-title">Completed</h2>
										<button class="toggle-link" onclick={toggleShowCompleted}>Show All Tasks</button>
									</div>
									{#each completedTasks as task (task.id)}
										<div class="task-item">
											<input
												type="checkbox"
												class="task-checkbox"
												id={task.id}
												checked={true}
												onchange={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content completed" onclick={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title">{truncateTitle(task.title)}</span>
												</div>
												<div class="task-meta">
													<span class="task-time">Completed</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<!-- Fallback for when in completed mode but no completed tasks -->
								<div class="empty-state">
									<div class="project-icon-large">📝</div>
									<h2>No completed tasks</h2>
									<p>You haven't completed any tasks yet.</p>
									<button class="toggle-link" onclick={toggleShowCompleted}>Show Active Tasks</button>
								</div>
							{/if}
						{/if}
				{/if}

				<!-- Notes -->
				{#if notes.length > 0}
					<div class="content-group">
						<h2 class="group-title">Notes</h2>
						{#each notes as note (note.id)}
							<a href="/notes/{note.id}" class="note-card">
								<div class="note-header">
									<h3>{truncateTitle(note.title, 50)}</h3>
								</div>
								<p class="note-preview">{getContentPreview(note)}</p>
								<div class="note-footer">
									<span class="note-date">{formatDate(note.updated_at)}</span>
									<span class="note-meta">{getWordCount(note)} words</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}

				<!-- Files -->
				{#if files.length > 0}
					<div class="content-group">
						<h2 class="group-title">Files</h2>
						<div class="files-grid">
							{#each files as file (file.id)}
								<a href="/files?file={file.id}" class="file-card-compact">
									<div class="file-thumbnail">
										{#if file.mime_type.startsWith('image/')}
											<img
												src={getThumbnailUrl(file.r2_url)}
												alt={file.title || file.filename}
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div class="file-icon-compact">
												<svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
													<path d="M14 2H34L42 10V46H6V2H14ZM32 4V12H40M10 20H38M10 28H38M10 36H28" />
												</svg>
											</div>
										{/if}
									</div>
									<div class="file-info-compact">
										<p class="file-name">{file.title || file.filename}</p>
									</div>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
			{/if}
		</div>
	</div>

	<!-- Edit Project Modal -->
	<EditProjectModal
		show={showEditModal}
		project={project}
		onClose={handleCloseEditModal}
		onUpdate={handleProjectUpdated}
	/>

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="modal-overlay" onclick={() => showDeleteConfirm = false}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<h2>Delete Project?</h2>
				<p>Are you sure you want to delete "{project?.name || 'this project'}"? This will also delete all tasks and notes in this project. This action cannot be undone.</p>
				<div class="modal-actions">
					<button type="button" class="secondary-btn" onclick={() => showDeleteConfirm = false}>
						Cancel
					</button>
					<button type="button" class="danger-btn" onclick={handleDeleteProject}>
						Delete Project
					</button>
				</div>
			</div>
		</div>
	{/if}

	<TaskEditModal
		show={showEditTaskModal}
		task={editingTask}
		projects={projects}
		onClose={() => showEditTaskModal = false}
		onSave={handleUpdateTask}
		onDelete={handleDeleteTask}
	/>

	<!-- New Task Modal -->
	{#if showNewTaskModal}
		<div class="modal-overlay" onclick={() => showNewTaskModal = false}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<h2>Create New Task</h2>
				<form onsubmit={(e) => { e.preventDefault(); handleCreateTask(); }}>
					<div class="form-group">
						<label for="task-title">Title</label>
						<input
							id="task-title"
							type="text"
							bind:value={newTaskTitle}
							placeholder="Task title"
							required
						/>
					</div>
					<div class="form-group">
						<label for="task-description">Description</label>
						<textarea
							id="task-description"
							bind:value={newTaskDescription}
							placeholder="Task description"
							rows="3"
						></textarea>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label for="task-priority">Priority</label>
							<select id="task-priority" bind:value={newTaskPriority}>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</select>
						</div>
						<div class="form-group">
							<label for="task-due-date">Due Date</label>
							<input
								id="task-due-date"
								type="date"
								bind:value={newTaskDueDate}
							/>
						</div>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" onclick={() => showNewTaskModal = false}>
							Cancel
						</button>
						<button type="submit" class="primary-btn">
							Create Task
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- New Note Modal -->
	{#if showNewNoteModal}
		<div class="modal-overlay" onclick={() => showNewNoteModal = false}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<h2>Create New Note</h2>
				<form onsubmit={(e) => { e.preventDefault(); handleCreateNote(); }}>
					<div class="form-group">
						<label for="note-title">Title (optional)</label>
						<input
							id="note-title"
							type="text"
							bind:value={newNoteTitle}
							placeholder="Untitled"
						/>
					</div>
					<div class="form-group">
						<label for="note-content">Content (optional)</label>
						<textarea
							id="note-content"
							bind:value={newNoteContent}
							placeholder="Note content"
							rows="6"
						></textarea>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" onclick={() => showNewNoteModal = false}>
							Cancel
						</button>
						<button type="submit" class="primary-btn">
							Create Note
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Hidden file input for mobile -->
	<input
		bind:this={fileInput}
		type="file"
		onchange={handleFileUpload}
		disabled={isUploading}
		style="display: none;"
	/>

	<!-- File Upload Modal -->
	{#if showFileUploadModal}
		<div class="modal-overlay" onclick={() => showFileUploadModal = false}>
			<div class="modal upload-modal" onclick={(e) => e.stopPropagation()}>
				<h2>Upload File</h2>

				<div
					class="upload-area"
					class:dragging={isDragging}
					class:uploading={isUploading}
					ondragenter={handleDragEnter}
					ondragleave={handleDragLeave}
					ondragover={handleDragOver}
					ondrop={handleDrop}
					onclick={() => fileInput?.click()}
					role="button"
					tabindex="0"
				>
					<svg width="48" height="48" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
						<path d="M7 7l3-3 3 3"/>
						<path d="M10 4v10"/>
					</svg>

					{#if isUploading}
						<p class="upload-text">Uploading...</p>
						<div class="progress-bar">
							<div class="progress-fill" style="width: {uploadProgress}%"></div>
						</div>
					{:else if isDragging}
						<p class="upload-text">Drop file here</p>
					{:else}
						<p class="upload-text">Drag & drop or click to upload</p>
						<p class="upload-hint">Maximum file size: 10MB</p>
					{/if}
				</div>

				<div class="modal-actions">
					<button type="button" class="secondary-btn" onclick={() => showFileUploadModal = false} disabled={isUploading}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Floating Action Button with Menu (Mobile Only) -->
	<div class="fab-container">
		{#if showFabMenu}
			<div class="fab-menu">
				<button class="fab-menu-item" onclick={() => { showNewTaskModal = true; showFabMenu = false; }}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 11l3 3L22 4"/>
						<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
					</svg>
					<span>Add Task</span>
				</button>
				<button class="fab-menu-item" onclick={() => { showNewNoteModal = true; showFabMenu = false; }}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M15 3l2 2-9 9-4 1 1-4 9-9z"/>
					</svg>
					<span>Add Note</span>
				</button>
				<button class="fab-menu-item" onclick={() => { fileInput?.click(); showFabMenu = false; }}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M13 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-3-5z"/>
						<path d="M13 2v5h3"/>
					</svg>
					<span>Add File</span>
				</button>
				<a class="fab-menu-item" href={`/projects/${projectId}/chat/mobile`}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10 2l1.5 3.5L15 7l-3.5 1.5L10 12l-1.5-3.5L5 7l3.5-1.5L10 2z"/>
						<path d="M5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
						<path d="M15 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
					</svg>
					<span>Create with AI</span>
				</a>
			</div>
		{/if}
		<button class="fab" onclick={() => showFabMenu = !showFabMenu} aria-label="Create options">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M12 5v14M5 12h14"/>
			</svg>
		</button>
	</div>
</div>
</AppLayout>

<style>

	.project-chat-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.project-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
		max-width: 100vw;
	}

	/* Mobile Layout (hidden on desktop) */
	.mobile-content {
		display: none;
	}

	/* Content Section (Tasks & Notes) */
	.content-section {
		flex: 2;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border-color);
		background: var(--bg-secondary);
		min-width: 0;
	}

	.section-header {
		flex-shrink: 0;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		box-sizing: border-box;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.back-btn {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		padding: 0;
		margin: 0;
	}

	.back-btn:hover {
		background: var(--bg-primary);
		transform: translateX(-2px);
	}

	.header-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.icon-btn {
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
	}

	.icon-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
	}

	.menu-container {
		position: relative;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 180px;
		z-index: 100;
		overflow: hidden;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		width: 100%;
		background: none;
		border: none;
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.menu-item:hover {
		background: var(--bg-tertiary);
	}

	.delete-item {
		color: rgb(239, 68, 68);
	}

	.delete-item svg {
		color: rgb(239, 68, 68);
	}

	.delete-item:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	/* New Item Button */
	.new-item-container {
		position: relative;
	}

	.new-item-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		height: 36px;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.new-item-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.new-item-btn svg {
		flex-shrink: 0;
	}

	.new-item-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 180px;
		overflow: hidden;
		z-index: 100;
		animation: slideDown 0.2s ease;
	}

	.new-item-dropdown .dropdown-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.new-item-dropdown .dropdown-item:last-child {
		border-bottom: none;
	}

	.new-item-dropdown .dropdown-item:hover {
		background: var(--bg-hover);
	}

	.new-item-dropdown .dropdown-item svg {
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Hide new item button on mobile */
	@media (max-width: 768px) {
		.new-item-container {
			display: none;
		}
	}

	.content-list {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 20px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.project-title-wrapper {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 20px 0 24px 0;
		padding: 0 20px;
	}

	.project-title-wrapper.mobile {
		margin: 0 0 20px 0;
		padding: 0;
	}

	.project-icon-title {
		font-size: 1.5rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.project-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		padding: 0;
		letter-spacing: -0.02em;
	}

	.task-group {
		margin-bottom: 32px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.group-title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.group-header .group-title {
		margin-bottom: 0;
	}

	.toggle-link {
		background: none;
		border: none;
		color: var(--accent-primary);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
	}

	.toggle-link:hover {
		background: var(--bg-tertiary);
	}

	/* Task Items */
	.task-item {
		display: flex;
		gap: 12px;
		padding: 12px;
		border-radius: var(--radius-md);
		margin-bottom: 8px;
		transition: all 0.2s ease;
		min-width: 0;
	}

	.task-item:hover {
		background: var(--bg-tertiary);
	}

	.task-checkbox {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		margin-top: 2px;
		cursor: pointer;
		accent-color: var(--accent-success);
	}

	.task-content {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		cursor: pointer;
		gap: 16px;
		text-decoration: none;
		color: var(--text-primary);
		min-width: 0;
	}

	.task-content.completed .task-title {
		text-decoration: line-through;
		color: var(--text-muted);
	}

	.task-main {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
		width: 0;
		padding-right: 16px;
		overflow: hidden;
	}

	.task-title {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.task-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.priority {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 4px;
		letter-spacing: 0.05em;
	}

	.priority.high {
		background: rgba(211, 47, 47, 0.1);
		color: var(--danger);
	}

	.priority.medium {
		background: rgba(199, 124, 92, 0.1);
		color: var(--accent-primary);
	}

	.priority.low {
		background: rgba(115, 115, 115, 0.1);
		color: var(--text-secondary);
	}

	.task-time {
		font-size: 0.8125rem;
		color: var(--text-muted);
	}

	/* Note Cards */
	.note-card {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 16px;
		margin-bottom: 12px;
		transition: all 0.2s ease;
		text-decoration: none;
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}

	.note-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		border-color: var(--accent-primary);
		background: var(--bg-secondary);
	}

	.note-header h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.note-preview {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
		color: var(--text-muted);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
	}

	/* Files Grid */
	.files-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.file-card-compact {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: all 0.2s ease;
		cursor: pointer;
		text-decoration: none;
		display: flex;
		flex-direction: column;
	}

	.file-card-compact:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.file-thumbnail {
		width: 100%;
		aspect-ratio: 1 / 1;
		background: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.file-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.file-icon-compact {
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.file-info-compact {
		padding: 12px;
	}

	.file-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Chat Section */
	.chat-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		min-width: 400px;
	}

	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chat-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.chat-title h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 2px;
	}

	.ai-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		opacity: 0;
	}

	.chat-loading-overlay {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding-top: calc(50% + 20px);
		gap: 16px;
		background: var(--bg-primary);
	}

	.chat-loading-overlay p {
		color: var(--text-secondary);
		font-size: 0.9375rem;
		margin: 0;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.message {
		display: flex;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		padding: 12px 16px;
		border-radius: 12px;
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.message-bubble p {
		margin: 0;
	}

	.message.user .message-bubble {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		text-align: left;
	}

	.message.ai .message-bubble {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
	}

	/* Typing Indicator */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 8px 4px;
	}

	.typing-indicator span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--text-secondary);
		animation: typing 1.2s ease-in-out infinite;
	}

	.typing-indicator span:nth-child(1) {
		animation-delay: 0s;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes typing {
		0%, 80%, 100% {
			transform: scale(1);
			opacity: 0.5;
		}
		40% {
			transform: scale(1.3);
			opacity: 1;
		}
	}

	.input-container {
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 12px;
		min-height: calc(76px + env(safe-area-inset-bottom));
		box-sizing: border-box;
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
	}

	.message-input {
		flex: 1;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 12px 16px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.send-btn {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.send-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.send-btn:active {
		transform: translateY(0);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Loading & Empty States */
	.loading-state,
	.empty-state {
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
	}

	.loading-state p {
		color: var(--text-secondary);
		margin: 0;
	}

	.empty-state h2 {
		font-size: 1.5rem;
		margin-bottom: 8px;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin-bottom: 24px;
	}

	.project-icon-large {
		width: 100px;
		height: 100px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 64px;
		margin-bottom: 8px;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal h2 {
		font-size: 1.25rem;
		margin-bottom: 12px;
	}

	.modal p {
		color: var(--text-secondary);
		margin-bottom: 24px;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.secondary-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		background: var(--bg-tertiary);
	}

	.danger-btn {
		padding: 10px 20px;
		background: rgb(239, 68, 68);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.danger-btn:hover {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
	}

	.danger-btn:active {
		transform: translateY(0);
	}

	.primary-btn {
		padding: 10px 20px;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.primary-btn:active {
		transform: translateY(0);
	}

	.delete-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid rgb(239, 68, 68);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: rgb(239, 68, 68);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	/* Task Detail Modal Styles */
	.task-detail-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-bottom: 24px;
	}

	.detail-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.detail-section label {
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	.detail-text {
		font-size: 0.9375rem;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.5;
	}

	.detail-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.due-status {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	/* Form Styles for Edit Modal */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		transition: all 0.2s ease;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	/* Mobile Responsive */
	@media (max-width: 1023px) {
		/* Hide desktop layout */
		.project-container {
			display: none;
		}

		/* Show mobile layout */
		.mobile-content {
			display: flex;
			flex-direction: column;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 50px; /* Above bottom nav */
			background: var(--bg-secondary);
		}

		.mobile-header {
			flex-shrink: 0;
			padding: 16px 20px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border-color);
			height: 64px;
			box-sizing: border-box;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
		}

		.mobile-header-left {
			display: flex;
			align-items: center;
			gap: 12px;
			flex: 1;
			min-width: 0;
		}

		.mobile-logo-button {
			display: flex;
			align-items: center;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
			flex-shrink: 0;
		}

		.mobile-logo {
			width: 52px;
			height: 52px;
			border-radius: var(--radius-sm);
			transition: all 0.15s ease;
		}

		.mobile-logo-button:active .mobile-logo {
			transform: translateY(4px) scale(0.95);
		}

		.mobile-header-actions {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.project-info-mobile {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 12px;
			min-width: 0;
		}

		.project-info-mobile h1 {
			font-size: 1.25rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			margin: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mobile-content-area {
			flex: 1;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
			padding: 20px;
			background: var(--bg-secondary);
		}

		/* Mobile files grid - 2 columns */
		.files-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}

		.fab-container {
			display: block;
			position: fixed;
			bottom: 80px;
			left: 27px;
			z-index: 50;
			margin-bottom: env(safe-area-inset-bottom);
		}

		.fab {
			width: 56px;
			height: 56px;
			border-radius: 50%;
			background: var(--accent-primary);
			color: white;
			border: none;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			transition: transform 0.3s ease;
			opacity: 0.7;
		}

		.fab:hover {
			transform: scale(1.05);
		}

		.fab:active {
			transform: scale(0.95);
		}

		.fab-menu {
			position: absolute;
			bottom: calc(100% + 12px);
			left: 0;
			background: var(--bg-secondary);
			border: 1px solid var(--border-color);
			border-radius: var(--radius-md);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			min-width: 180px;
			overflow: hidden;
			animation: slideUp 0.2s ease;
		}

		@keyframes slideUp {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		.fab-menu-item {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 14px 16px;
			width: 100%;
			background: transparent;
			border: none;
			border-bottom: 1px solid var(--border-color);
			cursor: pointer;
			transition: background 0.2s ease;
			color: var(--text-primary);
			font-size: 0.9375rem;
			font-weight: 500;
			text-align: left;
			text-decoration: none;
		}

		.fab-menu-item:last-child {
			border-bottom: none;
		}

		.fab-menu-item:hover {
			background: var(--bg-tertiary);
		}

		.fab-menu-item:active {
			transform: scale(0.98);
		}

		.fab-menu-item svg {
			flex-shrink: 0;
			color: var(--text-secondary);
		}
	}

	/* Hide FAB on desktop */
	@media (min-width: 1024px) {
		.fab-container {
			display: none;
		}
	}

	/* Upload Modal */
	.upload-area {
		border: 2px dashed var(--border-color);
		border-radius: var(--radius-lg);
		padding: 48px 24px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s ease;
		background: var(--bg-tertiary);
		margin-bottom: 20px;
	}

	.upload-area:hover {
		border-color: var(--accent-primary);
		background: var(--bg-secondary);
	}

	.upload-area.dragging {
		border-color: var(--accent-primary);
		background: rgba(199, 124, 92, 0.1);
	}

	.upload-area.uploading {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.upload-area svg {
		color: var(--text-muted);
		margin-bottom: 16px;
	}

	.upload-text {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.upload-hint {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.progress-bar {
		width: 100%;
		height: 4px;
		background: var(--bg-secondary);
		border-radius: 2px;
		overflow: hidden;
		margin-top: 16px;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent-primary);
		transition: width 0.3s ease;
	}
	.empty-active-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 0;
		gap: 16px;
		color: var(--text-secondary);
	}

	.empty-active-state p {
		margin: 0;
		font-size: 0.9375rem;
	}
</style>
