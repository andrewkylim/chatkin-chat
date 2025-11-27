import { describe, it, expect } from 'vitest';
import { getTools } from '../../src/ai/tools';

describe('AI Tools', () => {
  it('should return array of tools', () => {
    const tools = getTools();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(2);
  });

  it('should include ask_questions tool', () => {
    const tools = getTools();
    const askQuestions = tools.find(t => t.name === 'ask_questions');

    expect(askQuestions).toBeDefined();
    expect(askQuestions?.description).toContain('REQUIRED FIRST STEP');
    expect(askQuestions?.input_schema.type).toBe('object');
    expect(askQuestions?.input_schema.properties.questions).toBeDefined();
  });

  it('should include propose_operations tool', () => {
    const tools = getTools();
    const proposeOperations = tools.find(t => t.name === 'propose_operations');

    expect(proposeOperations).toBeDefined();
    expect(proposeOperations?.description).toContain('Propose create/update/delete operations');
    expect(proposeOperations?.input_schema.properties.summary).toBeDefined();
    expect(proposeOperations?.input_schema.properties.operations).toBeDefined();
  });

  it('should have valid operation types in propose_operations', () => {
    const tools = getTools();
    const proposeOperations = tools.find(t => t.name === 'propose_operations');
    const operationSchema = proposeOperations?.input_schema.properties.operations;

    expect(operationSchema.items.properties.operation.enum).toEqual(['create', 'update', 'delete']);
    expect(operationSchema.items.properties.type.enum).toEqual(['task', 'note', 'project']);
  });
});
