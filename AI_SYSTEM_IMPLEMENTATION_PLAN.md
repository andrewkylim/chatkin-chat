## 18. Complete Implementation Plan with Architecture

### 18.1 Architecture Overview & Separation of Concerns

**System Architecture Layers:**

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (SvelteKit - apps/web)                             │
├─────────────────────────────────────────────────────────────┤
│ - UI Components (modals, chat, task lists, profile)        │
│ - Client-side state management                              │
│ - API calls to worker                                        │
│ - Real-time UI updates                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓ API calls
┌─────────────────────────────────────────────────────────────┐
│ API LAYER (Cloudflare Worker - apps/worker)                │
├─────────────────────────────────────────────────────────────┤
│ - Route handlers (HTTP endpoints)                           │
│ - Authentication middleware                                  │
│ - Request validation                                         │
│ - Response formatting                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER (apps/worker/src/services)            │
├─────────────────────────────────────────────────────────────┤
│ - AI orchestrator (tool loop execution)                     │
│ - Message formatter (context building)                      │
│ - Pattern analyzer (observations generation)                │
│ - Onboarding generator (tasks/questions/notes)             │
│ - Notification service                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ AI LAYER (apps/worker/src/ai)                              │
├─────────────────────────────────────────────────────────────┤
│ - Prompt builders (system prompts, context formatting)      │
│ - Tool definitions (query_tasks, propose_operations, etc.)  │
│ - Claude client wrapper                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ DATA LAYER (Supabase)                                       │
├─────────────────────────────────────────────────────────────┤
│ - PostgreSQL database                                        │
│ - RLS policies                                               │
│ - Functions & triggers                                       │
│ - Views for computed data                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Architectural Principles:**

1. **Separation of Concerns**
   - Routes only handle HTTP (no business logic)
   - Services contain business logic (reusable across routes)
   - AI layer is abstracted (can swap Claude for other models)
   - Data layer has computed views (not computed in application code)

2. **Single Responsibility**
   - Each service has one job
   - Each route handles one endpoint
   - Each tool does one thing

3. **Dependency Injection**
   - Services receive dependencies (DB client, API keys) as parameters
   - No hardcoded dependencies
   - Easy to test and mock

4. **Database as Source of Truth**
   - Complex queries use DB views/functions
   - Application doesn't compute what DB can compute
   - Temporal data computed in DB (views for trends, adherence)

---

### 18.2 Phase-by-Phase Implementation Plan

#### **PHASE 1: Assessment & Report Foundation (Week 1-2)**

**Goal:** Get the coaching data foundation right

**Database Changes:**

```sql
-- File: packages/database/migrations/001_questionnaire_expansion.sql
-- Add 10-12 new assessment questions for values, identity, beliefs, avoidance

-- VALUES & MEANING (2-3 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('What would being physically healthy allow you to do that matters to you?', 'open_ended', 'Body', 36, 0.9),
('When you imagine financial security, what does that enable in your life?', 'open_ended', 'Finance', 37, 0.9),
('What gives you a sense of meaning or purpose day-to-day?', 'open_ended', 'Purpose', 38, 1.0);

-- IDENTITY & BELIEFS (3-4 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('How would you describe yourself when it comes to physical health?', 'open_ended', 'Body', 39, 1.0),
('Complete this sentence: "When it comes to money, I''m the kind of person who..."', 'open_ended', 'Finance', 40, 1.0),
('Do you believe you can develop new capabilities and skills, or are you limited by who you are?', 'multiple_choice', 'Growth', 41, 1.3),
('How do you typically describe yourself to others?', 'open_ended', 'Purpose', 42, 0.8);

-- Add options for the multiple choice question
UPDATE assessment_questions SET options = '[
  {"value": "fixed", "label": "I am who I am - can''t really change", "score": 1},
  {"value": "mostly_fixed", "label": "Some things can change, but core traits are fixed", "score": 2},
  {"value": "mixed", "label": "Some things I can develop, others I can''t", "score": 3},
  {"value": "mostly_growth", "label": "Most things can be developed with effort", "score": 4},
  {"value": "growth", "label": "I can develop almost any ability with practice", "score": 5}
]'::jsonb WHERE position = 41;

-- AVOIDANCE PATTERNS (2-3 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('What have you tried before to improve your health/fitness? What got in the way?', 'open_ended', 'Body', 43, 0.9),
('What do you avoid thinking about or dealing with right now?', 'open_ended', 'Mind', 44, 1.0);

-- DYNAMIC FOLLOW-UP PLACEHOLDERS (implementation handles dynamic insertion)
-- These will be inserted by frontend based on real-time scoring
```

```sql
-- File: packages/database/migrations/002_deprecate_communication_tone.sql
-- Mark communication_tone as deprecated

COMMENT ON COLUMN user_profiles.communication_tone IS 'DEPRECATED: Tone discovered through coaching, not auto-set. Will be removed in future migration.';

-- Don't drop yet (breaking change), but stop using in queries
```

```sql
-- File: packages/database/migrations/003_add_profile_fields.sql
-- Add exploration_questions field to user_profiles

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS exploration_questions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_profiles.exploration_questions IS 'Array of 0-6 contextual exploration questions for AI to use during coaching conversations';

CREATE INDEX IF NOT EXISTS idx_user_profiles_exploration_questions
ON user_profiles USING GIN (exploration_questions);
```

**Backend Changes:**

*File: `apps/worker/src/routes/generate-assessment-report.ts`*

1. Replace `generateAIReport()` function with new prompt (direct friend tone)
2. Replace `generateProfileSummary()` function with new prompt (coaching intel focus)
3. Remove communication_tone calculation (lines 93-97)
4. Remove communication_tone from profile upsert (line 126)

*File: `apps/worker/src/services/report-generator.ts` (NEW - extract logic)*

```typescript
/**
 * Report generation service
 * Separates prompt building and report generation from route handler
 */

export class ReportGenerator {
  constructor(
    private anthropicClient: any,
    private model: string = 'claude-sonnet-4-20250514'
  ) {}

  async generateUserReport(
    responses: QuestionResponse[],
    domainScores: DomainScores
  ): Promise<string> {
    const prompt = this.buildUserReportPrompt(responses, domainScores);

    const message = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    return message.content[0].text;
  }

  async generateProfileSummary(
    responses: QuestionResponse[],
    domainScores: DomainScores
  ): Promise<string> {
    const prompt = this.buildProfileSummaryPrompt(responses, domainScores);

    const message = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    });

    return message.content[0].text;
  }

  private buildUserReportPrompt(
    responses: QuestionResponse[],
    domainScores: DomainScores
  ): string {
    // [Full prompt from implementation plan Section 16]
    // "You are a direct, honest friend analyzing someone's life assessment..."
  }

  private buildProfileSummaryPrompt(
    responses: QuestionResponse[],
    domainScores: DomainScores
  ): string {
    // [Full prompt from implementation plan Section 16]
    // "You are creating a comprehensive coaching profile..."
  }
}

export function createReportGenerator(client: any): ReportGenerator {
  return new ReportGenerator(client);
}
```

**Frontend Changes:**

*File: `apps/web/src/routes/profile/+page.svelte`*

Add progressive disclosure for report domains (collapsible sections with scores)

**Testing:**
- [ ] New assessment questions appear in correct order
- [ ] Dynamic follow-up questions work (if implemented)
- [ ] Reports use direct friend tone (spot check)
- [ ] Profile summary captures identity, beliefs, avoidance
- [ ] communication_tone no longer auto-set
- [ ] Progressive disclosure works on profile page

---

#### **PHASE 2: Onboarding & Chat Mode Transformation (Week 3-4)**

**Goal:** Generate starter tasks, update Chat Mode to electric bike model

**Backend Changes:**

*File: `apps/worker/src/services/onboarding-generator.ts` (NEW - extract from route)*

```typescript
/**
 * Onboarding content generation service
 * Generates starter tasks, exploration questions, and domain primers
 */

export class OnboardingGenerator {
  constructor(
    private anthropicClient: any,
    private supabaseAdmin: any,
    private model: string = 'claude-sonnet-4-20250514'
  ) {}

  /**
   * Generate complete onboarding content
   */
  async generateOnboardingContent(
    userId: string,
    responses: QuestionResponse[],
    domainScores: DomainScores,
    profileSummary: string
  ): Promise<{
    starterTasks: number;
    explorationQuestions: number;
    domainPrimers: number;
  }> {
    // Run in parallel
    const [starterTasks, explorationQuestions, domainPrimers] = await Promise.all([
      this.generateStarterTasks(userId, responses, domainScores, profileSummary),
      this.generateExplorationQuestions(responses, domainScores, profileSummary),
      this.generateDomainPrimers(userId, domainScores)
    ]);

    // Store exploration questions in profile
    await this.supabaseAdmin
      .from('user_profiles')
      .update({ exploration_questions: explorationQuestions })
      .eq('user_id', userId);

    return {
      starterTasks: starterTasks.length,
      explorationQuestions: explorationQuestions.length,
      domainPrimers: domainPrimers.length
    };
  }

  private async generateStarterTasks(
    userId: string,
    responses: QuestionResponse[],
    domainScores: DomainScores,
    profileSummary: string
  ): Promise<Task[]> {
    const prompt = this.buildStarterTasksPrompt(responses, domainScores, profileSummary);

    const message = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const tasks = JSON.parse(message.content[0].text);

    // Get project IDs for domains
    const { data: projects } = await this.supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('user_id', userId);

    const projectMap = projects?.reduce((acc: any, p: any) => {
      acc[p.name] = p.id;
      return acc;
    }, {});

    // Insert tasks
    const tasksToInsert = tasks.map((task: any) => ({
      user_id: userId,
      title: task.title,
      description: task.description,
      status: 'todo',
      priority: 'low',
      project_id: projectMap?.[task.domain] || null
    }));

    await this.supabaseAdmin.from('tasks').insert(tasksToInsert);

    return tasks;
  }

  private async generateExplorationQuestions(
    responses: QuestionResponse[],
    domainScores: DomainScores,
    profileSummary: string
  ): Promise<string[]> {
    const prompt = this.buildExplorationQuestionsPrompt(responses, domainScores, profileSummary);

    const message = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    return JSON.parse(message.content[0].text);
  }

  private async generateDomainPrimers(
    userId: string,
    domainScores: DomainScores
  ): Promise<Note[]> {
    const prompt = this.buildDomainPrimersPrompt(domainScores);

    const message = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const notes = JSON.parse(message.content[0].text);

    // Get project IDs
    const { data: projects } = await this.supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('user_id', userId);

    const projectMap = projects?.reduce((acc: any, p: any) => {
      acc[p.name] = p.id;
      return acc;
    }, {});

    // Insert notes
    const notesToInsert = notes.map((note: any) => ({
      user_id: userId,
      title: note.title,
      content: note.content,
      project_id: projectMap?.[note.domain] || null,
      is_system_note: true
    }));

    await this.supabaseAdmin.from('notes').insert(notesToInsert);

    return notes;
  }

  private buildStarterTasksPrompt(...): string {
    // [Prompt from Section 16.2.2]
  }

  private buildExplorationQuestionsPrompt(...): string {
    // [Prompt from Section 16.2.2]
  }

  private buildDomainPrimersPrompt(...): string {
    // [Prompt from Section 16.2.3]
  }
}

export function createOnboardingGenerator(
  client: any,
  supabaseAdmin: any
): OnboardingGenerator {
  return new OnboardingGenerator(client, supabaseAdmin);
}
```

*File: `apps/worker/src/routes/generate-onboarding.ts`*

Simplify to use the service:

```typescript
export async function handleGenerateOnboarding(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    const supabaseAdmin = createSupabaseAdmin(env);
    const anthropicClient = createAnthropicClient(env.ANTHROPIC_API_KEY);

    // Fetch assessment data
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('profile_summary, domain_scores, focus_areas')
      .eq('user_id', user.userId)
      .single();

    const { data: responses } = await supabaseAdmin
      .from('assessment_responses')
      .select('*, assessment_questions(*)')
      .eq('user_id', user.userId);

    // Use service to generate content
    const generator = createOnboardingGenerator(anthropicClient, supabaseAdmin);
    const result = await generator.generateOnboardingContent(
      user.userId,
      responses,
      profile.domain_scores,
      profile.profile_summary
    );

    return new Response(JSON.stringify({
      success: true,
      created: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error, 'generate-onboarding', corsHeaders);
  }
}
```

*File: `apps/worker/src/ai/prompts/base.ts`*

Replace entire Chat Mode prompt with electric bike model (Section 16, Phase 2.1)

**Database Changes:**

```sql
-- File: packages/database/migrations/004_add_note_system_flag.sql
-- Add is_system_note field

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_system_note BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN notes.is_system_note IS 'True for system-generated primer notes, false for user/co-created notes';

CREATE INDEX IF NOT EXISTS idx_notes_is_system_note ON notes(is_system_note);
```

**Frontend Changes:**

*File: `apps/web/src/lib/components/OperationReviewModal.svelte`*

Implement inline editing capability (Section 18.2, Phase 4.4)

**Testing:**
- [ ] Onboarding generates 3-5 starter tasks
- [ ] Tasks are specific and personalized
- [ ] Exploration questions stored in profile
- [ ] Domain primers created as system notes
- [ ] Chat Mode loads exploration questions
- [ ] AI proposes tasks frequently (electric bike)
- [ ] Review modal has Edit button
- [ ] Inline editing works smoothly

---

#### **PHASE 3: Temporal Patterns & Proactive Coaching (Week 5-6)**

**Goal:** Add temporal data, create coach observations system

**Database Changes:**

```sql
-- File: packages/database/migrations/005_add_temporal_tracking.sql
-- Add timestamp fields to tasks for lifecycle tracking

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT NOW();

-- Create function to calculate days in progress
CREATE OR REPLACE FUNCTION calculate_days_in_progress(task tasks)
RETURNS INTEGER AS $$
BEGIN
  IF task.status = 'in_progress' AND task.started_at IS NOT NULL THEN
    RETURN EXTRACT(DAY FROM NOW() - task.started_at)::INTEGER;
  ELSIF task.status = 'completed' AND task.started_at IS NOT NULL AND task.completed_at IS NOT NULL THEN
    RETURN EXTRACT(DAY FROM task.completed_at - task.started_at)::INTEGER;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to calculate days overdue
CREATE OR REPLACE FUNCTION calculate_days_overdue(task tasks)
RETURNS INTEGER AS $$
BEGIN
  IF task.due_date IS NOT NULL AND task.status != 'completed' AND NOW() > task.due_date THEN
    RETURN EXTRACT(DAY FROM NOW() - task.due_date)::INTEGER;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create view for domain trends
CREATE OR REPLACE VIEW domain_trends AS
SELECT
  user_id,
  domain,
  COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days') AS tasks_completed_last_7_days,
  COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days') AS tasks_completed_last_30_days,
  AVG(EXTRACT(DAY FROM completed_at - created_at)) FILTER (WHERE completed_at IS NOT NULL) AS avg_completion_time_days,
  COUNT(*) FILTER (WHERE status = 'todo' AND created_at < NOW() - INTERVAL '30 days') AS abandoned_task_count
FROM tasks
GROUP BY user_id, domain;

-- Create view for recurring task adherence
CREATE OR REPLACE VIEW recurring_task_adherence AS
SELECT
  user_id,
  id AS task_id,
  title,
  recurrence_pattern,
  CASE
    WHEN recurrence_pattern = 'daily' THEN 30
    WHEN recurrence_pattern = 'weekly' THEN 4
    WHEN recurrence_pattern = 'monthly' THEN 1
    ELSE 0
  END AS expected_completions_last_30_days,
  COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days') AS actual_completions_last_30_days,
  ROUND(
    (COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days')::DECIMAL /
    CASE
      WHEN recurrence_pattern = 'daily' THEN 30
      WHEN recurrence_pattern = 'weekly' THEN 4
      WHEN recurrence_pattern = 'monthly' THEN 1
      ELSE 1
    END) * 100,
    1
  ) AS adherence_rate
FROM tasks
WHERE recurrence_pattern IS NOT NULL
GROUP BY user_id, id, title, recurrence_pattern;

-- Create trigger to update started_at and completed_at automatically
CREATE OR REPLACE FUNCTION update_task_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Update started_at when status changes to in_progress
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    NEW.started_at = NOW();
  END IF;

  -- Update completed_at when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;

  -- Always update last_modified_at
  NEW.last_modified_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_status_timestamps
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_timestamps();
```

```sql
-- File: packages/database/migrations/006_create_coach_observations.sql
-- Create table for pattern observations

CREATE TABLE IF NOT EXISTS coach_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  observation_type TEXT NOT NULL CHECK (observation_type IN ('pattern', 'concern', 'win', 'correlation', 'stuck')),
  content TEXT NOT NULL,
  data_summary JSONB NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  surfaced_at TIMESTAMPTZ,
  user_response TEXT,
  dismissed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_coach_observations_user ON coach_observations(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_observations_surfaced ON coach_observations(surfaced_at);
CREATE INDEX IF NOT EXISTS idx_coach_observations_priority ON coach_observations(priority);
CREATE INDEX IF NOT EXISTS idx_coach_observations_dismissed ON coach_observations(dismissed);

ALTER TABLE coach_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own observations" ON coach_observations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own observations" ON coach_observations
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON COLUMN coach_observations.data_summary IS 'JSON: { "task_ids": [], "pattern_data": {}, "timeframe": "last 14 days" }';
```

```sql
-- File: packages/database/migrations/007_add_last_active_tracking.sql
-- Add last_active to user_profiles for notification logic

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON user_profiles(last_active);

COMMENT ON COLUMN user_profiles.last_active IS 'Last time user opened the app (for notification trigger logic)';

-- Create trigger to update last_active on conversation activity
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET last_active = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_last_active_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION update_user_last_active();
```

**Backend Changes:**

*File: `apps/worker/src/services/pattern-analyzer.ts` (NEW)*

```typescript
/**
 * Pattern analysis service
 * Detects patterns in user behavior and generates coach observations
 */

export class PatternAnalyzer {
  constructor(private supabaseAdmin: any) {}

  async analyzeUserPatterns(userId: string): Promise<CoachObservation[]> {
    const observations: CoachObservation[] = [];

    // Load user data
    const [tasks, domainTrends, recurringAdherence] = await Promise.all([
      this.loadUserTasks(userId),
      this.loadDomainTrends(userId),
      this.loadRecurringAdherence(userId)
    ]);

    // Run pattern detectors
    observations.push(
      ...this.detectStuckTasks(tasks),
      ...this.detectDomainShutdown(domainTrends),
      ...this.detectRecurringFailure(recurringAdherence),
      ...this.detectWins(domainTrends)
    );

    return observations;
  }

  private async loadUserTasks(userId: string) {
    const { data } = await this.supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('user_id', userId);
    return data || [];
  }

  private async loadDomainTrends(userId: string) {
    const { data } = await this.supabaseAdmin
      .from('domain_trends')
      .select('*')
      .eq('user_id', userId);
    return data || [];
  }

  private async loadRecurringAdherence(userId: string) {
    const { data } = await this.supabaseAdmin
      .from('recurring_task_adherence')
      .select('*')
      .eq('user_id', userId);
    return data || [];
  }

  private detectStuckTasks(tasks: any[]): CoachObservation[] {
    const stuckTasks = tasks.filter(t => {
      if (t.status !== 'in_progress' || !t.started_at) return false;
      const daysInProgress = Math.floor(
        (Date.now() - new Date(t.started_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysInProgress > 7;
    });

    if (stuckTasks.length >= 3) {
      return [{
        type: 'stuck',
        content: `You have ${stuckTasks.length} tasks stuck "in progress" for over a week. What's really in the way?`,
        data_summary: {
          task_ids: stuckTasks.map(t => t.id),
          stuck_days: stuckTasks.map(t =>
            Math.floor((Date.now() - new Date(t.started_at).getTime()) / (1000 * 60 * 60 * 24))
          )
        },
        priority: 'high'
      }];
    }

    return [];
  }

  private detectDomainShutdown(domainTrends: any[]): CoachObservation[] {
    const shutdownDomains = domainTrends.filter(dt =>
      dt.tasks_completed_last_7_days === 0 &&
      dt.tasks_completed_last_30_days === 0 &&
      dt.abandoned_task_count > 3
    );

    if (shutdownDomains.length > 0) {
      const domain = shutdownDomains[0].domain;
      return [{
        type: 'pattern',
        content: `Your ${domain} domain has gone completely quiet. ${shutdownDomains[0].abandoned_task_count} tasks sitting there untouched. What's happening?`,
        data_summary: {
          domain,
          abandoned_count: shutdownDomains[0].abandoned_task_count,
          days_inactive: 14
        },
        priority: 'high'
      }];
    }

    return [];
  }

  private detectRecurringFailure(recurringAdherence: any[]): CoachObservation[] {
    const failing = recurringAdherence.filter(ra =>
      ra.adherence_rate < 50 &&
      ra.expected_completions_last_30_days >= 4
    );

    if (failing.length > 0) {
      const task = failing[0];
      return [{
        type: 'concern',
        content: `"${task.title}" has dropped to ${task.adherence_rate}% adherence. Worth talking about what changed?`,
        data_summary: {
          task_id: task.task_id,
          adherence_rate: task.adherence_rate,
          expected: task.expected_completions_last_30_days,
          actual: task.actual_completions_last_30_days
        },
        priority: 'medium'
      }];
    }

    return [];
  }

  private detectWins(domainTrends: any[]): CoachObservation[] {
    const thriving = domainTrends.filter(dt =>
      dt.tasks_completed_last_7_days > dt.tasks_completed_last_30_days / 4
    );

    if (thriving.length > 0) {
      const domain = thriving[0].domain;
      return [{
        type: 'win',
        content: `Something shifted in your ${domain} domain. You've completed ${thriving[0].tasks_completed_last_7_days} tasks this week. What changed?`,
        data_summary: {
          domain,
          completed_this_week: thriving[0].tasks_completed_last_7_days,
          avg_per_week: Math.round(thriving[0].tasks_completed_last_30_days / 4)
        },
        priority: 'low'
      }];
    }

    return [];
  }
}

export function createPatternAnalyzer(supabaseAdmin: any): PatternAnalyzer {
  return new PatternAnalyzer(supabaseAdmin);
}
```

*File: `apps/worker/src/cron/analyze-patterns.ts` (NEW)*

```typescript
/**
 * Cron job to analyze patterns and generate observations
 * Runs daily at 2am UTC
 */

import { createSupabaseAdmin } from '../utils/supabase-admin';
import { createPatternAnalyzer } from '../services/pattern-analyzer';
import { logger } from '../utils/logger';

export async function analyzePatterns(env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env);
  const analyzer = createPatternAnalyzer(supabase);

  // Get active users (engaged in last 7 days)
  const { data: activeUsers } = await supabase
    .from('user_profiles')
    .select('user_id')
    .gte('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  for (const user of activeUsers || []) {
    try {
      const observations = await analyzer.analyzeUserPatterns(user.user_id);

      if (observations.length > 0) {
        await supabase.from('coach_observations').insert(
          observations.map(obs => ({
            user_id: user.user_id,
            observation_type: obs.type,
            content: obs.content,
            data_summary: obs.data_summary,
            priority: obs.priority
          }))
        );

        logger.info('Created observations', { userId: user.user_id, count: observations.length });
      }
    } catch (error) {
      logger.error('Failed to analyze patterns', { userId: user.user_id, error });
    }
  }
}
```

*File: `apps/worker/src/index.ts`*

Add scheduled handler:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // ... existing fetch handler ...
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    logger.info('Running scheduled pattern analysis');

    try {
      await analyzePatterns(env);
      logger.info('Pattern analysis complete');
    } catch (error) {
      logger.error('Pattern analysis failed', { error });
    }
  }
};
```

*File: `wrangler.toml`*

Add cron trigger:

```toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2am UTC
```

*File: `apps/worker/src/services/notification-service.ts` (NEW)*

```typescript
/**
 * Notification service
 * Handles sending notifications for tasks, observations, and check-ins
 */

export class NotificationService {
  constructor(
    private supabaseAdmin: any,
    private env: Env
  ) {}

  async sendNotifications(): Promise<void> {
    const users = await this.getEligibleUsers();

    for (const user of users) {
      const notifications = await this.buildNotificationsForUser(user);

      for (const notification of notifications) {
        await this.sendNotification(user.user_id, notification);
      }
    }
  }

  private async getEligibleUsers() {
    // Get users who need notifications
    const { data } = await this.supabaseAdmin
      .from('user_profiles')
      .select('user_id, last_active')
      .not('last_active', 'is', null);

    return data || [];
  }

  private async buildNotificationsForUser(user: any): Promise<Notification[]> {
    const notifications: Notification[] = [];
    const daysSinceActive = Math.floor(
      (Date.now() - new Date(user.last_active).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Task due reminders (always)
    const dueTasks = await this.getDueTasks(user.user_id);
    if (dueTasks.length > 0) {
      notifications.push({
        type: 'task_due',
        title: `${dueTasks.length} task${dueTasks.length > 1 ? 's' : ''} due soon`,
        body: dueTasks[0].title,
        data: { task_ids: dueTasks.map(t => t.id) }
      });
    }

    // High-priority observations (only if inactive 3+ days)
    if (daysSinceActive >= 3) {
      const highPriorityObs = await this.getHighPriorityObservations(user.user_id);
      if (highPriorityObs.length > 0) {
        notifications.push({
          type: 'observation',
          title: 'Pattern detected',
          body: highPriorityObs[0].content,
          data: { observation_id: highPriorityObs[0].id }
        });
      }
    }

    // General check-in (if inactive 7+ days)
    if (daysSinceActive >= 7) {
      notifications.push({
        type: 'check_in',
        title: 'How's it going?',
        body: 'Haven't heard from you in a week. Everything okay?',
        data: {}
      });
    }

    return notifications;
  }

  private async getDueTasks(userId: string) {
    const { data } = await this.supabaseAdmin
      .from('tasks')
      .select('id, title, due_date')
      .eq('user_id', userId)
      .eq('status', 'todo')
      .not('due_date', 'is', null)
      .lte('due_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    return data || [];
  }

  private async getHighPriorityObservations(userId: string) {
    const { data } = await this.supabaseAdmin
      .from('coach_observations')
      .select('*')
      .eq('user_id', userId)
      .eq('priority', 'high')
      .is('surfaced_at', null)
      .eq('dismissed', false);

    return data || [];
  }

  private async sendNotification(userId: string, notification: Notification): Promise<void> {
    // Implementation depends on notification system (web push, email, etc.)
    logger.info('Sending notification', { userId, type: notification.type });

    // TODO: Implement actual notification sending
    // This could use web push API, email service, etc.
  }
}
```

*File: `apps/web/src/lib/db/context.ts`*

Update to load temporal data:

```typescript
export async function loadWorkspaceContext(): Promise<WorkspaceContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Existing queries
  const [projects, tasks, notes, userProfile] = await Promise.all([
    loadProjectsSummary(),
    loadTasksSummary(),
    loadNotesSummary(),
    loadUserProfile()
  ]);

  // NEW: Load temporal pattern data
  const [domainTrends, recurringAdherence] = await Promise.all([
    supabase.from('domain_trends').select('*').eq('user_id', user.id),
    supabase.from('recurring_task_adherence').select('*').eq('user_id', user.id)
  ]);

  // NEW: Add temporal data to tasks
  const tasksWithAge = tasks.map(task => ({
    ...task,
    days_in_progress: calculateDaysInProgress(task),
    days_overdue: calculateDaysOverdue(task)
  }));

  return {
    projects,
    tasks: tasksWithAge,
    notes,
    userProfile,
    domainTrends: domainTrends.data || [],
    recurringAdherence: recurringAdherence.data || []
  };
}

function calculateDaysInProgress(task: any): number | null {
  if (task.status === 'in_progress' && task.started_at) {
    return Math.floor((Date.now() - new Date(task.started_at).getTime()) / (1000 * 60 * 60 * 24));
  }
  if (task.status === 'completed' && task.started_at && task.completed_at) {
    return Math.floor((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / (1000 * 60 * 60 * 24));
  }
  return null;
}

function calculateDaysOverdue(task: any): number {
  if (task.due_date && task.status !== 'completed' && new Date() > new Date(task.due_date)) {
    return Math.floor((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
  }
  return 0;
}
```

*File: `apps/worker/src/routes/ai-chat.ts`*

Update to load and surface observations:

```typescript
export async function handleAIChat(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  // ... existing code ...

  const supabaseAdmin = createSupabaseAdmin(env);

  // Load unsurfaced observations
  const { data: observations } = await supabaseAdmin
    .from('coach_observations')
    .select('*')
    .eq('user_id', user.userId)
    .is('surfaced_at', null)
    .eq('dismissed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(3);

  // If observations exist and conversation is starting
  if (observations && observations.length > 0 && conversationHistory.length <= 2) {
    // Add observations to system prompt
    const observationsContext = `

## Coach Observations Available

You have ${observations.length} pattern observations you can surface:

${observations.map((obs, i) => `
${i + 1}. [${obs.observation_type}] ${obs.content}
   Data: ${JSON.stringify(obs.data_summary)}
   Priority: ${obs.priority}
`).join('\n')}

Choose the MOST relevant one to surface based on the conversation. Use your opening move to bring it up naturally:
- "I've been watching your patterns. Want to hear what I'm seeing?"
- "Can I name something I noticed before we get into today?"
- "Something shifted this week. Want to talk about it?"

Don't dump all observations. Pick one, explore it.
`;

    systemPrompt += observationsContext;
  }

  // ... rest of existing code ...

  // After AI response, mark first observation as surfaced
  if (observations && observations.length > 0 && conversationHistory.length <= 2) {
    await supabaseAdmin
      .from('coach_observations')
      .update({ surfaced_at: new Date().toISOString() })
      .eq('id', observations[0].id);
  }

  // ... return response ...
}
```

**Testing:**
- [ ] Temporal views populate correctly
- [ ] Task timestamps update automatically on status change
- [ ] Pattern analysis cron detects stuck tasks, domain shutdown, etc.
- [ ] Observations created and stored
- [ ] Observations surface in chat naturally
- [ ] Notifications sent based on correct logic
- [ ] last_active updates on user activity

---

#### **PHASE 4: Memory Improvements & Polish (Week 7-8)**

**Goal:** Load note content, improve memory context

**Database Changes:**

```sql
-- File: packages/database/migrations/008_add_note_content_field.sql
-- Ensure notes.content is TEXT type (not limited varchar)

-- Check if content column exists and modify if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'content'
  ) THEN
    ALTER TABLE notes ALTER COLUMN content TYPE TEXT;
  ELSE
    ALTER TABLE notes ADD COLUMN content TEXT;
  END IF;
END $$;

-- Add full-text search index on note content
CREATE INDEX IF NOT EXISTS idx_notes_content_fts
ON notes USING GIN (to_tsvector('english', content));
```

**Backend Changes:**

*File: `apps/web/src/lib/db/context.ts`*

Update `loadNotesSummary()` to load full content:

```typescript
async function loadNotesSummary(): Promise<NoteSummary[]> {
  const { data: notes, error } = await supabase
    .from('notes')
    .select(`
      id,
      title,
      content,  // ADD THIS - was missing before
      updated_at,
      project_id,
      projects (name)
    `)
    .order('updated_at', { ascending: false })
    .limit(15);  // Load last 15 notes with content (was 50 titles only)

  if (error) throw error;
  if (!notes) return [];

  return (notes as unknown as NoteWithProjectResponse[]).map(note => ({
    id: note.id,
    title: note.title,
    content: note.content,  // ADD THIS
    project_name: note.projects?.name || null,
    updated_at: note.updated_at
  }));
}
```

*File: `apps/web/src/lib/db/context.ts`*

Update `formatWorkspaceContextForAI()`:

```typescript
export function formatWorkspaceContextForAI(context: WorkspaceContext): string {
  let formatted = '## Workspace Context\n\n';

  // ... existing profile, projects, tasks formatting ...

  // Notes section - NOW WITH CONTENT
  if (context.notes.length > 0) {
    formatted += '### Recent Notes (Last 15)\n';
    for (const note of context.notes) {
      formatted += `\n**${note.title || 'Untitled'}** [id: ${note.id}]`;
      if (note.project_name) {
        formatted += ` [Project: ${note.project_name}]`;
      }
      formatted += `\nUpdated: ${new Date(note.updated_at).toLocaleDateString()}\n`;

      // ADD CONTENT (truncate if very long)
      if (note.content) {
        const truncated = note.content.length > 500
          ? note.content.substring(0, 500) + '...'
          : note.content;
        formatted += `${truncated}\n`;
      }
    }
    formatted += '\n';
  } else {
    formatted += '### Recent Notes\n(No notes yet)\n\n';
  }

  // ADD: Domain trends
  if (context.domainTrends && context.domainTrends.length > 0) {
    formatted += '### Domain Activity Trends\n';
    for (const trend of context.domainTrends) {
      formatted += `- **${trend.domain}**: ${trend.tasks_completed_last_7_days} completed this week, ${trend.abandoned_task_count} tasks abandoned\n`;
    }
    formatted += '\n';
  }

  // ADD: Recurring task adherence
  if (context.recurringAdherence && context.recurringAdherence.length > 0) {
    formatted += '### Recurring Task Adherence\n';
    for (const adherence of context.recurringAdherence) {
      if (adherence.adherence_rate < 80) {  // Only show struggling ones
        formatted += `- "${adherence.title}": ${adherence.adherence_rate}% adherence (${adherence.actual_completions_last_30_days}/${adherence.expected_completions_last_30_days})\n`;
      }
    }
    formatted += '\n';
  }

  return formatted;
}
```

**Testing:**
- [ ] Note content loads in context (last 15 notes)
- [ ] AI can reference insights from user's notes
- [ ] Domain trends appear in context
- [ ] Recurring adherence data loads
- [ ] Context window still under limits (~20K tokens)

---

### 18.3 SQL Migration Files to Run

Here are the SQL files you need to run, in order:

```bash
# Phase 1 (✅ COMPLETED)
psql -U postgres -d chatkin < packages/database/migrations/010_questionnaire_expansion.sql
psql -U postgres -d chatkin < packages/database/migrations/011_add_profile_fields.sql
psql -U postgres -d chatkin < packages/database/migrations/012_deprecate_communication_tone.sql

# Phase 2
psql -U postgres -d chatkin < packages/database/migrations/016_add_note_system_flag.sql

# Phase 3 (✅ COMPLETED)
psql -U postgres -d chatkin < packages/database/migrations/013_add_temporal_tracking.sql
psql -U postgres -d chatkin < packages/database/migrations/014_create_coach_observations.sql
psql -U postgres -d chatkin < packages/database/migrations/015_add_last_active_tracking.sql

# Phase 4 (✅ COMPLETED)
psql -U postgres -d chatkin < packages/database/migrations/017_add_note_content_field.sql
```

**Or via Supabase Dashboard:**
1. Go to SQL Editor
2. Copy/paste each migration file content
3. Run in order (010-017)

**Migration Status:** ✅ All migrations run successfully!

---

### 18.4 Architecture Summary

**Clean Separation of Concerns:**

```
Routes (apps/worker/src/routes/)
├─ Handle HTTP only
├─ Authenticate requests
├─ Call services
└─ Return responses

Services (apps/worker/src/services/)
├─ report-generator.ts (assessment report generation)
├─ onboarding-generator.ts (starter tasks, questions, primers)
├─ pattern-analyzer.ts (detect patterns, generate observations)
├─ notification-service.ts (send notifications)
├─ ai-orchestrator.ts (tool loop execution)
└─ message-formatter.ts (context building)

AI Layer (apps/worker/src/ai/)
├─ prompts/base.ts (system prompts)
├─ tools/ (tool definitions)
└─ client.ts (Claude API wrapper)

Data Layer (Supabase)
├─ Tables (tasks, notes, projects, conversations, etc.)
├─ Views (domain_trends, recurring_task_adherence)
├─ Functions (calculate_days_in_progress, etc.)
└─ Triggers (auto-update timestamps)

Cron Jobs (apps/worker/src/cron/)
├─ analyze-patterns.ts (daily pattern detection)
└─ send-notifications.ts (notification dispatch)
```

**Benefits:**
- ✅ Routes are thin (just HTTP handling)
- ✅ Business logic in services (reusable, testable)
- ✅ AI prompts isolated (easy to iterate)
- ✅ Database does heavy lifting (views for computed data)
- ✅ Cron jobs separate from request handling

---

**READY TO IMPLEMENT. Let me know which phase you want to start with, or if you want all the SQL migrations now.**
