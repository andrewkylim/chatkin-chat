# Tasks Page Refactoring Plan

## Overview

**Objective**: Eliminate ~1,435 lines of duplicated code by migrating `/routes/tasks/+page.svelte` to use the `UnifiedChatPage` component and extracting reusable components.

**Current State**:
- `/routes/tasks/+page.svelte`: 1,835 lines with embedded chat logic
- `/routes/tasks/chat/+page.svelte`: Already uses `UnifiedChatPage` (mobile route)
- Duplicated chat logic: ~300 lines

**Target State**:
- `/routes/tasks/+page.svelte`: ~400 lines (78% reduction)
- New components: `TaskList.svelte`, `SideBySideLayout.svelte`
- Enhanced `UnifiedChatPage.svelte` with callbacks

**Benefits**:
- Single source of truth for chat functionality
- Consistent AI behavior across all pages
- Easier maintenance and bug fixes
- Code reusability for notes page refactoring

---

## Mobile Behavior Preservation (CRITICAL)

**Current Mobile UX** (must be preserved exactly):
- Route: `/tasks` → Shows **list only** with FAB button
- Route: `/tasks/chat` → Shows **full-screen chat** (uses UnifiedChatPage)
- FAB button navigates to `/tasks/chat`
- Breakpoint: 1023px

**Implementation Strategy**:
- Desktop: Side-by-side layout (list + embedded chat)
- Mobile: Hide side-by-side layout, show list only + FAB
- FAB links to `/tasks/chat` (NOT `/notes/chat` - verify this!)

---

## Phase 1: Extract TaskList Component

**Duration**: 30 minutes

### 1.1 Create `/lib/components/TaskList.svelte`

Extract pure presentation logic for the task list UI.

**Props Interface**:
```typescript
export let tasks: Task[] = [];
export let projects: Project[] = [];
export let loading: boolean = false;
export let showCompletedTasks: boolean = true;
export let onToggleTask: (taskId: string, currentStatus: string) => void;
export let onTaskClick: (task: Task) => void;
export let onCreateTask: () => void;
export let onDeleteTask: (taskId: string, taskTitle: string) => void;
```

**What to Extract** (from tasks/+page.svelte):
- Task list rendering logic (lines ~200-400)
- Task grouping by project
- Empty states
- Task item cards
- Completed tasks section
- Loading skeletons

**What NOT to Extract** (stays in parent):
- Task CRUD operations (`loadData`, `toggleTask`, etc.)
- Project data fetching
- State management
- Modal handlers

**Styling**:
- Move task-specific CSS to TaskList.svelte
- Keep layout CSS in parent

### 1.2 Verification Checklist
- [ ] Component renders correctly with sample data
- [ ] All callbacks work (toggle, click, create, delete)
- [ ] Empty states display properly
- [ ] Loading skeletons match current design
- [ ] Completed tasks toggle works
- [ ] No TypeScript errors

---

## Phase 2: Add Callbacks to UnifiedChatPage

**Duration**: 45 minutes

### 2.1 Modify `/lib/components/UnifiedChatPage.svelte`

Add optional callback props for parent component communication.

**New Props**:
```typescript
export let onOperationsComplete: ((operations: Operation[]) => Promise<void>) | undefined = undefined;
export let onDataChange: (() => Promise<void>) | undefined = undefined;
```

### 2.2 Modify `executeOperations` Function

**Location**: UnifiedChatPage.svelte, `executeOperations` function

**Changes**:
```typescript
async function executeOperations(operations: Operation[], messageIndex: number) {
	// ... existing operation execution logic ...

	// Track successful operations
	let successCount = 0;

	for (const operation of operations) {
		try {
			await executeOperation(operation);
			successCount++;
		} catch (error) {
			// ... existing error handling ...
		}
	}

	// NEW: Trigger parent callbacks after operations complete
	if (successCount > 0) {
		try {
			// Call operation-specific callback
			if (onOperationsComplete) {
				await onOperationsComplete(operations);
			}

			// Call general data refresh callback
			if (onDataChange) {
				await onDataChange();
			}
		} catch (callbackError) {
			logger.error('Parent callback failed', callbackError);
			// Don't fail the entire operation if parent callback fails
		}
	}

	// ... show success message ...
}
```

### 2.3 Update `/routes/tasks/chat/+page.svelte`

Add the new callback prop (even though it's a separate route, consistency is good):

```svelte
<script lang="ts">
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';

	async function handleDataChange() {
		// On mobile route, we don't need to refresh list
		// But we can use this for future features
		logger.info('Task operations completed on mobile chat');
	}
</script>

<UnifiedChatPage
	scope="tasks"
	pageTitle="Tasks AI"
	welcomeMessage="✓ Hi! I can help you manage your tasks. What would you like to work on?"
	onDataChange={handleDataChange}
/>
```

### 2.4 Verification Checklist
- [ ] UnifiedChatPage compiles without errors
- [ ] Callbacks are optional (undefined by default)
- [ ] Operations execute successfully without callbacks
- [ ] Operations execute successfully WITH callbacks
- [ ] Callback errors don't break operation flow
- [ ] No breaking changes to existing pages

---

## Phase 3: Create SideBySideLayout Component

**Duration**: 30 minutes

### 3.1 Create `/lib/components/SideBySideLayout.svelte`

Reusable two-column layout wrapper.

**Component Code**:
```svelte
<script lang="ts">
	export let leftPanelClass: string = 'left-panel';
	export let rightPanelClass: string = 'right-panel';
	export let mobileBreakpoint: number = 1023; // px
</script>

<div class="side-by-side-container">
	<div class="{leftPanelClass}">
		<slot name="left" />
	</div>

	<div class="{rightPanelClass}">
		<slot name="right" />
	</div>
</div>

<style>
	.side-by-side-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
		gap: 0;
	}

	.side-by-side-container :global(.left-panel) {
		flex: 0 0 45%;
		overflow-y: auto;
		border-right: 1px solid var(--border-color);
	}

	.side-by-side-container :global(.right-panel) {
		flex: 1;
		overflow: hidden;
	}

	/* CRITICAL: Hide on mobile to show mobile-content instead */
	@media (max-width: 1023px) {
		.side-by-side-container {
			display: none;
		}
	}
</style>
```

**Design Notes**:
- Left panel: 45% width (tasks list)
- Right panel: 55% width (chat)
- Gap: 0 (border on left panel instead)
- Mobile: Completely hidden (not just stacked)

### 3.2 Verification Checklist
- [ ] Desktop layout displays correctly (side-by-side)
- [ ] Mobile layout is hidden (display: none)
- [ ] Slots render content properly
- [ ] Custom classes can be passed
- [ ] Border between panels matches design
- [ ] Overflow behavior works correctly

---

## Phase 4: Refactor Tasks Page

**Duration**: 45 minutes

### 4.1 Update `/routes/tasks/+page.svelte` Structure

**New Structure**:
```svelte
<script lang="ts">
	import TaskList from '$lib/components/TaskList.svelte';
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';
	import SideBySideLayout from '$lib/components/SideBySideLayout.svelte';
	import { goto } from '$app/navigation';
	// ... other imports ...

	// State variables (same as before)
	let tasks: Task[] = [];
	let projects: Project[] = [];
	let loading = true;
	let showCompletedTasks = true;
	// ... etc ...

	// CRUD operations (same as before)
	async function loadData() { /* ... */ }
	async function toggleTask(taskId: string, currentStatus: string) { /* ... */ }
	async function handleTaskClick(task: Task) { /* ... */ }
	// ... etc ...

	// NEW: Callback for UnifiedChatPage
	async function handleOperationsComplete(operations: Operation[]) {
		logger.info('AI operations completed, refreshing task list', {
			operationCount: operations.length
		});
		await loadData();
	}

	// NEW: Navigate to mobile chat
	function openMobileChat() {
		goto('/tasks/chat');
	}

	onMount(loadData);
</script>

<!-- DESKTOP: Side-by-side layout (hidden on mobile) -->
<SideBySideLayout leftPanelClass="tasks-section" rightPanelClass="chat-section">
	<svelte:fragment slot="left">
		<TaskList
			{tasks}
			{projects}
			{loading}
			{showCompletedTasks}
			onToggleTask={toggleTask}
			onTaskClick={handleTaskClick}
			onCreateTask={openCreateModal}
			onDeleteTask={handleDeleteTask}
		/>
	</svelte:fragment>

	<svelte:fragment slot="right">
		<UnifiedChatPage
			scope="tasks"
			pageTitle="Tasks AI"
			welcomeMessage="✓ Hi! I can help you manage your tasks. What would you like to work on?"
			onOperationsComplete={handleOperationsComplete}
			onDataChange={loadData}
		/>
	</svelte:fragment>
</SideBySideLayout>

<!-- MOBILE: List only with FAB (shown only on mobile) -->
<div class="mobile-content">
	<TaskList
		{tasks}
		{projects}
		{loading}
		{showCompletedTasks}
		onToggleTask={toggleTask}
		onTaskClick={handleTaskClick}
		onCreateTask={openCreateModal}
		onDeleteTask={handleDeleteTask}
	/>
</div>

<!-- MOBILE: FAB button -->
<div class="fab-container">
	<button
		class="fab"
		on:click={openMobileChat}
		aria-label="Open AI assistant"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
		</svg>
	</button>
</div>

<!-- Modals (unchanged) -->
{#if showCreateModal}
	<CreateTaskModal ... />
{/if}

{#if showEditModal && selectedTask}
	<EditTaskModal ... />
{/if}

{#if showDeleteProjectModal && projectToDelete}
	<DeleteProjectModal ... />
{/if}

<style>
	/* Mobile content - shown only on mobile */
	.mobile-content {
		display: none;
	}

	@media (max-width: 1023px) {
		.mobile-content {
			display: block;
			padding: 20px;
			padding-bottom: 100px; /* Space for FAB */
		}
	}

	/* FAB button */
	.fab-container {
		display: none;
	}

	@media (max-width: 1023px) {
		.fab-container {
			display: block;
			position: fixed;
			bottom: 24px;
			right: 24px;
			z-index: 100;
		}

		.fab {
			width: 56px;
			height: 56px;
			border-radius: 50%;
			background: var(--accent-primary);
			border: none;
			color: white;
			cursor: pointer;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease;
		}

		.fab:hover {
			background: var(--accent-hover);
			transform: scale(1.05);
		}

		.fab:active {
			transform: scale(0.95);
		}
	}

	/* Keep only layout-level styles here */
	/* All task list styles moved to TaskList.svelte */
</style>
```

### 4.2 Code Removal Checklist

**Remove from tasks/+page.svelte**:
- [ ] All task list rendering HTML (moved to TaskList.svelte)
- [ ] Task card styling (moved to TaskList.svelte)
- [ ] Empty state HTML (moved to TaskList.svelte)
- [ ] Loading skeleton HTML (moved to TaskList.svelte)
- [ ] Completed tasks section HTML (moved to TaskList.svelte)
- [ ] Chat implementation code (replaced with UnifiedChatPage)
- [ ] Message state management (handled by UnifiedChatPage)
- [ ] AI streaming logic (handled by UnifiedChatPage)
- [ ] Operation execution (handled by UnifiedChatPage)
- [ ] Desktop side-by-side layout CSS (moved to SideBySideLayout)

**Keep in tasks/+page.svelte**:
- [ ] All CRUD operation functions (loadData, toggleTask, etc.)
- [ ] Modal state management
- [ ] Modal components
- [ ] onMount lifecycle
- [ ] Project/task state variables
- [ ] Mobile-specific CSS
- [ ] FAB button implementation

### 4.3 CRITICAL: FAB Link Verification

**Action Required**:
```svelte
<!-- VERIFY this links to /tasks/chat NOT /notes/chat -->
<div class="fab-container">
	<button
		class="fab"
		on:click={() => goto('/tasks/chat')}  <!-- Must be /tasks/chat! -->
		aria-label="Open AI assistant"
	>
		<!-- ... -->
	</button>
</div>
```

### 4.4 Final Verification Checklist

**Desktop (>1023px)**:
- [ ] Side-by-side layout displays
- [ ] Left: Task list renders correctly
- [ ] Right: Chat interface renders correctly
- [ ] Task list updates when AI creates/modifies tasks
- [ ] Chat reflects task changes
- [ ] All task CRUD operations work
- [ ] All modals work
- [ ] No FAB button visible

**Mobile (≤1023px)**:
- [ ] Side-by-side layout is hidden
- [ ] Mobile task list displays
- [ ] FAB button is visible
- [ ] FAB links to `/tasks/chat` (NOT `/notes/chat`)
- [ ] `/tasks/chat` route works correctly
- [ ] Task operations work on mobile
- [ ] Modals work on mobile

**Functional Tests**:
- [ ] Create task via AI → task appears in list
- [ ] Update task via AI → task updates in list
- [ ] Delete task via AI → task removed from list
- [ ] Create task manually → works
- [ ] Toggle task completion → works
- [ ] Edit task → works
- [ ] Delete task → works
- [ ] Filter by project → works
- [ ] Show/hide completed tasks → works

**Code Quality**:
- [ ] No TypeScript errors
- [ ] No console.* calls (all replaced with logger/handleError)
- [ ] No code duplication between desktop/mobile
- [ ] Proper error handling throughout
- [ ] Accessibility attributes preserved

---

## Expected Code Metrics

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| tasks/+page.svelte | 1,835 lines | ~400 lines | 78% |
| Duplicated chat logic | ~300 lines | 0 lines | 100% |
| Total components | 1 | 4 | - |
| Reusable components | 0 | 3 | - |

---

## Rollback Strategy

If issues arise during implementation:

1. **Phase 4 Issues**: Revert tasks/+page.svelte from git
   ```bash
   git checkout HEAD -- apps/web/src/routes/tasks/+page.svelte
   ```

2. **Phase 3 Issues**: Delete SideBySideLayout.svelte
   ```bash
   rm apps/web/src/lib/components/SideBySideLayout.svelte
   ```

3. **Phase 2 Issues**: Revert UnifiedChatPage.svelte
   ```bash
   git checkout HEAD -- apps/web/src/lib/components/UnifiedChatPage.svelte
   ```

4. **Phase 1 Issues**: Delete TaskList.svelte
   ```bash
   rm apps/web/src/lib/components/TaskList.svelte
   ```

---

## Testing Procedure

### Manual Testing Steps

1. **Desktop Layout**:
   - Open `/tasks` on desktop browser (>1024px width)
   - Verify side-by-side layout
   - Create task via AI
   - Verify task appears in left panel
   - Toggle task completion
   - Edit task
   - Delete task

2. **Mobile Layout**:
   - Open `/tasks` on mobile (or resize to <1024px)
   - Verify only task list is visible
   - Verify FAB button exists
   - Click FAB button
   - Verify navigation to `/tasks/chat`
   - Create task via AI
   - Navigate back to `/tasks`
   - Verify task appears in list

3. **Edge Cases**:
   - Empty task list
   - No projects
   - All tasks completed
   - Very long task titles
   - Tasks with no due dates
   - Tasks with no projects

---

## Timeline

- **Phase 1**: 30 minutes (TaskList extraction)
- **Phase 2**: 45 minutes (UnifiedChatPage callbacks)
- **Phase 3**: 30 minutes (SideBySideLayout creation)
- **Phase 4**: 45 minutes (Tasks page refactoring)
- **Testing**: 30 minutes
- **Total**: 3 hours

---

## Future Considerations

After successful implementation:

1. **Apply same pattern to notes page** (`/routes/notes/+page.svelte`)
2. **Extract common project list component** (if projects page needs refactoring)
3. **Consider extracting modal components** (CreateTaskModal, EditTaskModal, etc.)
4. **Add automated tests** for critical paths
5. **Performance monitoring** for callback execution

---

## Success Criteria

✅ All existing functionality works exactly as before
✅ Mobile behavior is identical to current implementation
✅ Desktop shows side-by-side layout with embedded chat
✅ AI operations trigger task list updates
✅ Code reduced by ~78% (1,835 → ~400 lines)
✅ No console.* calls remaining
✅ No TypeScript errors
✅ All accessibility attributes preserved
✅ FAB button links to `/tasks/chat` (verified)

---

## Notes

- **Priority**: Mobile behavior preservation > Code reduction
- **Testing**: Test mobile thoroughly before considering phase complete
- **Rollback**: Keep git history clean - commit after each phase
- **Documentation**: Update component docs if needed
- **Performance**: Monitor callback execution time in production
