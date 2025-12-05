/**
 * System prompt builder
 */

import type { ChatRequest } from '@chatkin/types/api';
import { getChatModePrompt, getActionModePrompt } from './base';
import { getGlobalPrompt } from './global';

export function buildSystemPrompt(
  context: ChatRequest['context'],
  workspaceContext?: string,
  mode: 'chat' | 'action' = 'action'
): string {
  const scope = context?.scope || 'global';
  const domain = context?.domain;
  const projectId = context?.projectId;

  // Build soft context hint
  let contextHint = '';
  if (scope === 'notes') {
    contextHint = '\n**Context:** You\'re on the Notes page. User is browsing their notes collection.\n';
  } else if (scope === 'tasks') {
    contextHint = '\n**Context:** You\'re on the Tasks page. User is browsing their tasks.\n';
  } else if (scope === 'project' && projectId) {
    contextHint = `\n**Context:** You're focused on a specific project (ID: ${projectId}). When creating or managing items, they should be related to this project context.\n`;
  } else if (domain) {
    contextHint = `\n**Context:** You're on the ${domain} domain page. When creating new items, default to the ${domain} domain unless the user specifies otherwise.\n`;
  }

  // Always use global prompt (no scope restrictions)
  let systemPrompt = getGlobalPrompt();
  systemPrompt += contextHint;

  // Add mode-specific prompt
  systemPrompt += '\n\n';
  systemPrompt += mode === 'chat'
    ? getChatModePrompt(workspaceContext)
    : getActionModePrompt(workspaceContext);

  return systemPrompt;
}
