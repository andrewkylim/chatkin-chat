import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/ai/prompts';

describe('AI Prompt Builder', () => {
  it('should build prompt with global scope in action mode', () => {
    const prompt = buildSystemPrompt({ scope: 'global' }, undefined, 'action');

    expect(prompt).toContain('The Operator');
    expect(prompt).toContain('intelligent assistant integrated into a life management system');
    expect(prompt).toContain('Body, Mind, Purpose, Connection, Growth, Finance');
  });

  it('should build prompt with global scope in chat mode', () => {
    const prompt = buildSystemPrompt({ scope: 'global' }, undefined, 'chat');

    expect(prompt).toContain('insightful conversation partner');
    expect(prompt).toContain('Chat Mode');
    expect(prompt).toContain('Body, Mind, Purpose, Connection, Growth, Finance');
  });

  it('should build prompt with tasks scope', () => {
    const prompt = buildSystemPrompt({ scope: 'tasks' });

    expect(prompt).toContain('The Operator');
    // Tasks scope doesn't add specific text, just uses base prompt
    expect(prompt).toContain('intelligent assistant');
  });

  it('should build prompt with notes scope', () => {
    const prompt = buildSystemPrompt({ scope: 'notes' });

    expect(prompt).toContain('The Operator');
    // Notes scope doesn't add specific text, just uses base prompt
    expect(prompt).toContain('intelligent assistant');
  });

  it('should build prompt with project scope', () => {
    const projectId = 'test-project-123';
    const prompt = buildSystemPrompt({ scope: 'project', projectId });

    expect(prompt).toContain('The Operator');
    expect(prompt).toContain('specific project');
  });

  it('should include workspace context when provided', () => {
    const workspaceContext = '## Workspace Context\n\n### Projects\n- Test Project [id: abc]';
    const prompt = buildSystemPrompt({ scope: 'global' }, workspaceContext);

    expect(prompt).toContain(workspaceContext);
    expect(prompt).toContain('Test Project');
  });

  it('should include today\'s date in prompt', () => {
    const prompt = buildSystemPrompt({ scope: 'global' });
    const todayDate = new Date().toISOString().split('T')[0];

    expect(prompt).toContain(`Today's date is ${todayDate}`);
  });

  it('should include character limits', () => {
    const prompt = buildSystemPrompt({ scope: 'global' });

    expect(prompt).toContain('titles: 50 characters max');
    expect(prompt).toContain('Character Limits');
  });

  it('should include smart defaults section', () => {
    const prompt = buildSystemPrompt({ scope: 'global' });

    expect(prompt).toContain('Smart Defaults');
    expect(prompt).toContain('Buy milk');
  });

  it('should default to action mode', () => {
    const prompt = buildSystemPrompt({ scope: 'global' });

    // When mode is not specified, should default to action mode
    expect(prompt).toContain('The Operator');
  });
});
