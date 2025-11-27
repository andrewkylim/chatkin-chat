/**
 * System prompt builder
 */

import type { ChatRequest } from '@chatkin/types/api';
import { getBasePrompt } from './base';
import { getGlobalPrompt } from './global';
import { getTasksPrompt } from './tasks';
import { getNotesPrompt } from './notes';
import { getProjectPrompt } from './project';

export function buildSystemPrompt(
  context: ChatRequest['context'],
  workspaceContext?: string
): string {
  let systemPrompt = getBasePrompt(workspaceContext);

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
