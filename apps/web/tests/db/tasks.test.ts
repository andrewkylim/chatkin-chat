import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
  deleteOldCompletedTasks
} from '../../src/lib/db/tasks';
import { supabase } from '$lib/supabase';
import type { Task } from '@chatkin/types';

describe('Tasks Database Operations', () => {
  const mockTask: Task = {
    id: 'task-123',
    user_id: 'user-123',
    project_id: 'project-123',
    title: 'Test Task',
    description: 'Test Description',
    status: 'todo',
    priority: 'medium',
    due_date: '2025-12-31',
    due_time: null,
    is_all_day: true,
    completed_at: null,
    created_at: '2025-11-27T00:00:00Z',
    updated_at: '2025-11-27T00:00:00Z',
    is_recurring: false,
    recurrence_pattern: null,
    parent_task_id: null,
    recurrence_end_date: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTasks', () => {
    it('should fetch all tasks', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [mockTask],
            error: null
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const tasks = await getTasks();

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(tasks).toEqual([mockTask]);
    });

    it('should filter tasks by project', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [mockTask],
        error: null
      });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: mockEq
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await getTasks('project-123');

      expect(mockEq).toHaveBeenCalledWith('project_id', 'project-123');
    });

    it('should throw error on database error', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await expect(getTasks()).rejects.toThrow('Database error');
    });
  });

  describe('getTask', () => {
    it('should fetch a single task by id', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const task = await getTask('task-123');

      expect(task).toEqual(mockTask);
    });

    it('should throw error when task not found', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Task not found')
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await expect(getTask('nonexistent')).rejects.toThrow('Task not found');
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const newTask = {
        title: 'New Task',
        description: 'New Description',
        status: 'todo' as const,
        priority: 'high' as const,
        due_date: '2025-12-31',
        due_time: null,
        is_all_day: true,
        project_id: null,
        is_recurring: false,
        recurrence_pattern: null,
        parent_task_id: null,
        recurrence_end_date: null
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockTask, ...newTask },
              error: null
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const task = await createTask(newTask);

      expect(task.title).toBe('New Task');
      expect(supabase.from).toHaveBeenCalledWith('tasks');
    });

    it('should throw error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      } as never);

      await expect(createTask({
        title: 'Task',
        status: 'todo',
        priority: 'medium',
        project_id: null,
        description: null,
        due_date: null,
        due_time: null,
        is_all_day: true,
        is_recurring: false,
        recurrence_pattern: null,
        parent_task_id: null,
        recurrence_end_date: null
      })).rejects.toThrow('Not authenticated');
    });

    it('should include user_id from authenticated user', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-456' } },
        error: null
      } as never);

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockTask,
            error: null
          })
        })
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await createTask({
        title: 'Task',
        status: 'todo',
        priority: 'medium',
        project_id: null,
        description: null,
        due_date: null,
        due_time: null,
        is_all_day: true,
        is_recurring: false,
        recurrence_pattern: null,
        parent_task_id: null,
        recurrence_end_date: null
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-456' })
      );
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', async () => {
      const updates = { title: 'Updated Task' };

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockTask, ...updates },
                error: null
              })
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const task = await updateTask('task-123', updates);

      expect(task.title).toBe('Updated Task');
    });

    it('should set updated_at timestamp', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });

      const mockFrom = vi.fn().mockReturnValue({
        update: mockUpdate
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await updateTask('task-123', { title: 'Updated' });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: expect.any(String) })
      );
    });

    it('should throw error on update failure', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Update failed')
              })
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await expect(updateTask('task-123', {})).rejects.toThrow('Update failed');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      });

      const mockFrom = vi.fn().mockReturnValue({
        delete: mockDelete
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await deleteTask('task-123');

      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw error on delete failure', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: new Error('Delete failed')
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await expect(deleteTask('task-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('toggleTaskComplete', () => {
    it('should mark task as completed', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockTask, status: 'completed', completed_at: '2025-11-27T00:00:00Z' },
                error: null
              })
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const task = await toggleTaskComplete('task-123', true);

      expect(task.status).toBe('completed');
      expect(task.completed_at).toBeTruthy();
    });

    it('should mark task as incomplete', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockTask, status: 'todo', completed_at: null },
                error: null
              })
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const task = await toggleTaskComplete('task-123', false);

      expect(task.status).toBe('todo');
      expect(task.completed_at).toBeNull();
    });
  });

  describe('deleteOldCompletedTasks', () => {
    it('should delete completed tasks older than 30 days', async () => {
      const mockLt = vi.fn().mockResolvedValue({
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: mockLt
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await deleteOldCompletedTasks();

      expect(mockLt).toHaveBeenCalled();
      // Verify the date is approximately 30 days ago
      const callArgs = mockLt.mock.calls[0];
      expect(callArgs[0]).toBe('completed_at');
      expect(callArgs[1]).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      } as never);

      await expect(deleteOldCompletedTasks()).rejects.toThrow('Not authenticated');
    });
  });
});
