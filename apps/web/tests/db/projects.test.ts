import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProjects,
  getProject,
  updateProject,
  getProjectStats
} from '../../src/lib/db/projects';
import { supabase } from '$lib/supabase';
import type { Project } from '@chatkin/types';

describe('Projects Database Operations', () => {
  const mockProject: Project = {
    id: 'project-123',
    user_id: 'user-123',
    name: 'Test Project',
    description: 'Test Description',
    color: '📁',
    domain: 'Body',
    created_at: '2025-11-27T00:00:00Z',
    updated_at: '2025-11-27T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should fetch all projects', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [mockProject],
            error: null
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const projects = await getProjects();

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(projects).toEqual([mockProject]);
    });

    it('should order projects by updated_at descending', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [mockProject],
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: mockOrder
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await getProjects();

      expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
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

      await expect(getProjects()).rejects.toThrow('Database error');
    });
  });

  describe('getProject', () => {
    it('should fetch a single project by id', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProject,
              error: null
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const project = await getProject('project-123');

      expect(project).toEqual(mockProject);
    });

    it('should throw error when project not found', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Project not found')
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await expect(getProject('nonexistent')).rejects.toThrow('Project not found');
    });
  });

  // describe('createProject', () => {
  //   it('should create a new project', async () => {
  //     const newProject = {
  //       name: 'New Project',
  //       description: 'New Description',
  //       color: '🎨',
  //       domain: null
  //     };
  //
  //     const mockFrom = vi.fn().mockReturnValue({
  //       insert: vi.fn().mockReturnValue({
  //         select: vi.fn().mockReturnValue({
  //           single: vi.fn().mockResolvedValue({
  //             data: { ...mockProject, ...newProject },
  //             error: null
  //           })
  //         })
  //       })
  //     });
  //     vi.mocked(supabase.from).mockImplementation(mockFrom as never);
  //
  //     const project = await createProject(newProject);
  //
  //     expect(project.name).toBe('New Project');
  //     expect(supabase.from).toHaveBeenCalledWith('projects');
  //   });
  //
  //   it('should throw error when not authenticated', async () => {
  //     vi.mocked(supabase.auth.getUser).mockResolvedValue({
  //       data: { user: null },
  //       error: null
  //     } as never);
  //
  //     await expect(createProject({
  //       name: 'Project',
  //       description: null,
  //       color: null,
  //       domain: null
  //     })).rejects.toThrow('Not authenticated');
  //   });
  //
  //   it('should include user_id from authenticated user', async () => {
  //     vi.mocked(supabase.auth.getUser).mockResolvedValue({
  //       data: { user: { id: 'user-789' } },
  //       error: null
  //     } as never);
  //
  //     const mockInsert = vi.fn().mockReturnValue({
  //       select: vi.fn().mockReturnValue({
  //         single: vi.fn().mockResolvedValue({
  //           data: mockProject,
  //           error: null
  //         })
  //       })
  //     });
  //
  //     const mockFrom = vi.fn().mockReturnValue({
  //       insert: mockInsert
  //     });
  //     vi.mocked(supabase.from).mockImplementation(mockFrom as never);
  //
  //     await createProject({
  //       name: 'Project',
  //       description: null,
  //       color: null,
  //       domain: null
  //     });
  //
  //     expect(mockInsert).toHaveBeenCalledWith(
  //       expect.objectContaining({ user_id: 'user-789' })
  //     );
  //   });
  // });

  describe('updateProject', () => {
    it('should update an existing project', async () => {
      const updates = { description: 'Updated Description' };

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockProject, ...updates },
                error: null
              })
            })
          })
        })
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const project = await updateProject('project-123', updates);

      expect(project.description).toBe('Updated Description');
    });

    it('should set updated_at timestamp', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProject,
              error: null
            })
          })
        })
      });

      const mockFrom = vi.fn().mockReturnValue({
        update: mockUpdate
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      await updateProject('project-123', { description: 'Updated' });

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

      await expect(updateProject('project-123', { description: null })).rejects.toThrow('Update failed');
    });
  });

  // describe('deleteProject', () => {
  //   it('should delete a project', async () => {
  //     const mockDelete = vi.fn().mockReturnValue({
  //       eq: vi.fn().mockResolvedValue({
  //         error: null
  //       })
  //     });
  //
  //     const mockFrom = vi.fn().mockReturnValue({
  //       delete: mockDelete
  //     });
  //     vi.mocked(supabase.from).mockImplementation(mockFrom as never);
  //
  //     await deleteProject('project-123');
  //
  //     expect(mockDelete).toHaveBeenCalled();
  //   });
  //
  //   it('should throw error on delete failure', async () => {
  //     const mockFrom = vi.fn().mockReturnValue({
  //       delete: vi.fn().mockReturnValue({
  //         eq: vi.fn().mockResolvedValue({
  //           error: new Error('Delete failed')
  //         })
  //       })
  //     });
  //     vi.mocked(supabase.from).mockImplementation(mockFrom as never);
  //
  //     await expect(deleteProject('project-123')).rejects.toThrow('Delete failed');
  //   });
  // });

  describe('getProjectStats', () => {
    it('should fetch project statistics', async () => {
      const mockTasks = [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'todo' },
        { id: 'task-3', status: 'completed' }
      ];
      const mockNotes = [
        { id: 'note-1' },
        { id: 'note-2' }
      ];
      const mockFiles = [
        { id: 'file-1' },
        { id: 'file-2' },
        { id: 'file-3' }
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockTasks,
                error: null
              })
            })
          };
        } else if (table === 'notes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockNotes,
                error: null
              })
            })
          };
        } else if (table === 'files') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: mockFiles,
                  error: null
                })
              })
            })
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const stats = await getProjectStats('project-123');

      expect(stats).toEqual({
        totalTasks: 3,
        completedTasks: 2,
        totalNotes: 2,
        totalFiles: 3
      });
    });

    it('should handle missing tasks', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          };
        } else if (table === 'notes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'note-1' }],
                error: null
              })
            })
          };
        } else if (table === 'files') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 'file-1' }],
                  error: null
                })
              })
            })
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const stats = await getProjectStats('project-123');

      expect(stats.totalTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.totalNotes).toBe(1);
      expect(stats.totalFiles).toBe(1);
    });

    it('should handle missing notes', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'task-1', status: 'todo' }],
                error: null
              })
            })
          };
        } else if (table === 'notes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          };
        } else if (table === 'files') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 'file-1' }],
                  error: null
                })
              })
            })
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as never);

      const stats = await getProjectStats('project-123');

      expect(stats.totalTasks).toBe(1);
      expect(stats.completedTasks).toBe(0);
      expect(stats.totalNotes).toBe(0);
      expect(stats.totalFiles).toBe(1);
    });
  });
});
