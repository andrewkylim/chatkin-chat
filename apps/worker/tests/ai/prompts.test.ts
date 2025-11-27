import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/ai/prompts';

describe('AI Prompt Builder', () => {
  it('should build prompt with global scope', () => {
    const prompt = buildSystemPrompt({ scope: 'global' });

    expect(prompt).toContain('You are a helpful AI assistant');
    expect(prompt).toContain('GLOBAL AI assistant');
    expect(prompt).toContain('You can see all workspace data');
  });

  it('should build prompt with tasks scope', () => {
    const prompt = buildSystemPrompt({ scope: 'tasks' });

    expect(prompt).toContain('TASKS AI assistant');
    expect(prompt).toContain('task management');
    expect(prompt).toContain('Domain boundary: You work exclusively with tasks');
  });

  it('should build prompt with notes scope', () => {
    const prompt = buildSystemPrompt({ scope: 'notes' });

    expect(prompt).toContain('NOTES AI assistant');
    expect(prompt).toContain('knowledge capture');
    expect(prompt).toContain('Domain boundary: You work exclusively with notes');
  });

  it('should build prompt with project scope', () => {
    const projectId = 'test-project-123';
    const prompt = buildSystemPrompt({ scope: 'project', projectId });

    expect(prompt).toContain('PROJECT AI assistant');
    expect(prompt).toContain(projectId);
    expect(prompt).toContain('project-specific task and note management');
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

    expect(prompt).toContain('Task titles: 50 characters max');
    expect(prompt).toContain('Note titles: 50 characters max');
    expect(prompt).toContain('Project names: 50 characters max');
  });

  it('should include smart defaults section', () => {
    const prompt = buildSystemPrompt({ scope: 'global' });

    expect(prompt).toContain('Smart Defaults for Simple Requests');
    expect(prompt).toContain('"Buy milk"');
    expect(prompt).toContain('"Call mom tomorrow"');
  });
});
