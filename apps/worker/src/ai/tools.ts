/**
 * AI Tool definitions for Claude
 */

export function getTools() {
  return [
    {
      name: 'ask_questions',
      description: 'REQUIRED FIRST STEP for all create operations. When a user asks to create a task/note, you MUST call this tool immediately - do NOT respond with text. This tool shows a modal with multiple choice questions. Only after receiving answers should you use propose_operations.',
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
                  enum: ['task', 'note'],
                  description: 'The type of item (projects cannot be created/deleted)'
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
    },
    {
      name: 'query_tasks',
      description: 'Query the complete tasks database when the snapshot is insufficient. Use this when the user asks for "all tasks", filtered tasks, or tasks outside the snapshot scope.',
      input_schema: {
        type: 'object' as const,
        properties: {
          filters: {
            type: 'object' as const,
            properties: {
              project_id: {
                type: 'string' as const,
                description: 'Filter by project ID'
              },
              status: {
                type: 'string' as const,
                enum: ['pending', 'in_progress', 'completed', 'archived'],
                description: 'Filter by status'
              },
              search_query: {
                type: 'string' as const,
                description: 'Search in title and description'
              }
            }
          },
          limit: {
            type: 'number' as const,
            description: 'Max results (default 50, max 100)'
          }
        }
      }
    },
    {
      name: 'query_notes',
      description: 'Query the complete notes database when the snapshot is insufficient. Use for "all notes", search queries, or notes outside snapshot.',
      input_schema: {
        type: 'object' as const,
        properties: {
          filters: {
            type: 'object' as const,
            properties: {
              search_query: {
                type: 'string' as const,
                description: 'Search in title and content'
              },
              project_id: {
                type: 'string' as const,
                description: 'Filter by project'
              }
            }
          },
          limit: {
            type: 'number' as const,
            description: 'Max results (default 50, max 100)'
          }
        }
      }
    },
    {
      name: 'query_projects',
      description: 'Query all projects. Use when user asks for project lists or project-specific information.',
      input_schema: {
        type: 'object' as const,
        properties: {
          include_archived: {
            type: 'boolean' as const,
            description: 'Include archived projects'
          },
          search_query: {
            type: 'string' as const,
            description: 'Search in name and description'
          }
        }
      }
    },
    {
      name: 'query_files',
      description: 'Query files by name, type, description, or project. Files have title and description fields that can be searched.',
      input_schema: {
        type: 'object' as const,
        properties: {
          filters: {
            type: 'object' as const,
            properties: {
              project_id: {
                type: 'string' as const,
                description: 'Filter by project'
              },
              conversation_id: {
                type: 'string' as const,
                description: 'Filter by conversation'
              },
              search_query: {
                type: 'string' as const,
                description: 'Search in filename, title, and description'
              },
              mime_type_prefix: {
                type: 'string' as const,
                description: 'Filter by MIME type (e.g., "image/", "application/pdf")'
              },
              is_hidden_from_library: {
                type: 'boolean' as const,
                description: 'Include hidden files'
              }
            }
          },
          limit: {
            type: 'number' as const,
            description: 'Max results (default 50, max 100)'
          }
        }
      }
    }
  ];
}

/**
 * Get tools for Chat Mode (read-only, query tools only)
 */
export function getChatModeTools() {
  const allTools = getTools();
  // Only include query tools for chat mode
  return allTools.filter(tool =>
    tool.name.startsWith('query_')
  );
}

/**
 * Get tools for Action Mode (full CRUD operations)
 */
export function getActionModeTools() {
  // Return all tools for action mode
  return getTools();
}

/**
 * Get tools based on mode
 */
export function getToolsForMode(mode: 'chat' | 'action') {
  return mode === 'chat' ? getChatModeTools() : getActionModeTools();
}
