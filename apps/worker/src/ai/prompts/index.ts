/**
 * System prompt builder
 */

import type { ChatRequest } from '@chatkin/types/api';
import { getChatModePrompt, getActionModePrompt } from './base';
import { getGlobalPrompt } from './global';
import { getTasksPrompt } from './tasks';
import { getNotesPrompt } from './notes';
import { getProjectPrompt } from './project';

export function buildSystemPrompt(
  context: ChatRequest['context'],
  workspaceContext?: string,
  mode: 'chat' | 'action' = 'chat'
): string {
  // Use mode-specific base prompt
  let systemPrompt = mode === 'chat'
    ? getChatModePrompt(workspaceContext)
    : getActionModePrompt(workspaceContext);

  // Add project-specific context
  if (context?.projectId) {
    systemPrompt += '\n\nYou are currently assisting with a specific project. All tasks/notes you create should be relevant to this project context.';
  }

  // Add scope-specific prompts
  const scope = context?.scope || 'global';

  switch (scope) {
    case 'global':
      systemPrompt += getGlobalPrompt();
      break;
    case 'tasks':
      systemPrompt += getTasksPrompt();
      break;
    case 'notes':
      systemPrompt += getNotesPrompt();
      break;
    case 'project':
      systemPrompt += getProjectPrompt(context?.projectId);
      break;
  }

  return systemPrompt;
}
