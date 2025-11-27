/**
 * AI Tool definitions for Claude
 */

export function getTools() {
  return [
    {
      name: 'ask_questions',
      description: 'REQUIRED FIRST STEP for all create operations. When a user asks to create a task/note/project, you MUST call this tool immediately - do NOT respond with text. This tool shows a modal with multiple choice questions. Only after receiving answers should you use propose_operations.',
      input_schema: {
        type: 'object' as const,
        properties: {
          questions: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                question: {
                  type: 'string' as const,
                  description: 'The question to ask'
                },
                options: {
                  type: 'array' as const,
                  items: { type: 'string' as const },
                  description: 'Multiple choice options (user can also select "Other" to provide custom answer)'
                }
              },
              required: ['question', 'options']
            }
          }
        },
        required: ['questions']
      }
    },
    {
      name: 'propose_operations',
      description: 'Propose create/update/delete operations to user for confirmation. Use this ONLY AFTER you have gathered complete information via ask_questions tool. This is Step 2 in the creation workflow - information gathering (ask_questions) comes first.',
      input_schema: {
        type: 'object' as const,
        properties: {
          summary: {
            type: 'string' as const,
            description: 'Brief summary of what you will do (e.g., "I\'ll create 3 tasks for your workout plan")'
          },
          operations: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                operation: {
                  type: 'string' as const,
                  enum: ['create', 'update', 'delete'],
                  description: 'The type of operation'
                },
                type: {
                  type: 'string' as const,
                  enum: ['task', 'note', 'project'],
                  description: 'The type of item'
                },
                id: {
                  type: 'string' as const,
                  description: 'Item ID (required for update/delete, from workspace context)'
                },
                data: {
                  type: 'object' as const,
                  description: 'Item data (for create operations)'
                },
                changes: {
                  type: 'object' as const,
                  description: 'Fields to update (for update operations)'
                },
                reason: {
                  type: 'string' as const,
                  description: 'Reason for deletion (for delete operations)'
                }
              },
              required: ['operation', 'type']
            }
          }
        },
        required: ['summary', 'operations']
      }
    }
  ];
}
