# Research: AI Creation Flow Analysis

**Objective:** Analyze the current `chatkin-os` AI workflow and propose architectural changes to shift from a "Rigid Command-Line" model to a "Conversational Consultant" model.

## 1. Current State Analysis (`apps/worker/src/index.ts`)

The current system uses a **Rigid 2-Step Workflow**:
1.  **Mandatory Interrogation:** The system prompt instructs the AI to *always* use `ask_questions` (a modal) before creating anything.
2.  **Execution:** The AI uses `propose_operations` only after getting answers.

### Strengths (Keep these)
*   **✅ Scope Awareness:** The logic correctly handles `scope` (Global vs Tasks vs Notes), preventing the "Tasks AI" from creating Notes.
*   **✅ Tool Separation:** Separating "Information Gathering" (`ask_questions`) from "Execution" (`propose_operations`) is architecturally sound.
*   **✅ Context Injection:** The workspace summary is correctly fed to the AI.

### Weaknesses (Fix these)
*   **❌ Conflicting Instructions:** The prompt demands "ALWAYS ask questions" but ends with "Use smart defaults." This causes inconsistent behavior (sometimes skipping the modal).
*   **❌ "Modal Fatigue":** Forcing a modal for simple tasks ("Buy milk") creates high friction.
*   **❌ Missing Classification Layer:** The AI jumps straight to *how* to create (Task vs Note) without first verifying *what* the user actually intends (e.g., "Kitchen Reno" could be a Project OR a Note).

---

## 2. Proposed Architecture: "The Conversational Consultant"

Instead of a hard-coded rule ("Always use Modal"), we should implement an **Intelligent Classification Logic** within the System Prompt.

### The New Decision Matrix

The AI should evaluate every request against this matrix:

| Request Type | Example | Complexity | Action |
| :--- | :--- | :--- | :--- |
| **Simple Task** | "Remind me to call Mom." | Low | **Execute Immediately** (Use Smart Defaults) |
| **Complex Task** | "Fix the bugs." | Medium | **Clarify** (Ask: "Which bugs? Priority?") |
| **Project** | "Plan my wedding." | High | **Consult** (Ask: "Timeline? Scale? Vibe?") |
| **Ambiguous** | "Kitchen Renovation." | High | **Classify** (Ask: "Project or Note?") |

### The Workflow

1.  **User Input:** "Plan my wedding."
2.  **Internal Monologue (AI):**
    *   *Is this simple?* No.
    *   *Is the intent clear?* Yes (Project).
    *   *Do I have required info (Timeline, Scale)?* No.
3.  **Action:** Call `ask_questions` (or reply text) to gather missing info.
    *   *AI:* "I'd love to help! When is the wedding and how many guests?"
4.  **User Reply:** "June, 150 guests."
5.  **Action:** Call `propose_operations` with a high-quality draft.

---

## 3. Implementation Plan (For Claude)

To achieve this, we need to update `apps/worker/src/index.ts`:

1.  **Update System Prompt:**
    *   Remove the "ALWAYS use ask_questions" rule.
    *   Replace with a **"Confidence Threshold"** rule: "If request is simple/clear, execute. If complex/vague, ask."
    *   Add **"Classification Logic"**: Explicitly instruct the AI to distinguish between Tasks (actions), Projects (goals), and Notes (info).

2.  **Refine Tools:**
    *   Keep `ask_questions` but reframe it as a "Clarification Tool" rather than a "Mandatory Form."
    *   Ensure `propose_operations` remains the final execution step.

3.  **Remove Conflicts:**
    *   Delete the contradictory "Use smart defaults" line if it conflicts with the new logic. Instead, bake the "Smart Defaults" logic directly into the "Simple Task" handling instructions.
