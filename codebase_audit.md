# Chatkin OS Codebase Audit

**Date:** 2025-11-26 (Updated)
**Overall Rating:** 6/10 (Downgraded from 7/10 due to growing technical debt)

## Executive Summary
The project foundation remains strong (SvelteKit + Cloudflare + Supabase), but technical debt is accumulating faster than features. The backend worker has grown into a larger monolith (520+ lines) despite empty folders suggesting an intent to refactor. Critical issues like type mismatches between frontend and backend remain unaddressed, and there is still **zero automated testing**. Immediate action is required to arrest this decline before adding more complexity.

## 1. Architecture & Stack
**Rating:** 9/10
-   **Strengths:**
    -   **Cloudflare Ecosystem:** Using Workers and Pages ensures high availability and low latency globally.
    -   **SvelteKit:** Excellent choice for a performant, interactive frontend.
    -   **Supabase:** Solid choice for a scalable database and auth solution.
    -   **Monorepo:** `pnpm` workspaces allow for efficient code sharing and dependency management.
-   **Weaknesses:**
    -   **"Zombie" Refactoring:** The `apps/worker/src` directory now contains `ai/` and `uploads/` folders, but they are **empty**. The code remains trapped in `index.ts`. This indicates a stalled attempt at modularity.

## 2. Code Quality & Organization
**Rating:** 5/10 (Downgraded)
-   **Strengths:**
    -   **Frontend:** Svelte components remain clean and well-structured.
-   **Critical Issues:**
    -   **Growing Worker Monolith:** `apps/worker/src/index.ts` has grown from 440 to **520+ lines**. It mixes routing, AI prompt construction, tool definitions, and file upload logic. This is a single point of failure and hard to maintain.
    -   **Type Mismatch (CRITICAL):**
        -   `packages/types/src/api.ts` defines `ChatRequest` using **snake_case** (`conversation_id`, `project_id`).
        -   `apps/worker/src/index.ts` defines `ChatRequest` using **camelCase** (`conversationId`, `projectId`).
        -   **Impact:** If the frontend uses the shared type, the backend will fail to read the properties, leading to silent failures or "undefined" errors.
    -   **Hardcoded AI Logic:** The system prompt and tool definitions are hardcoded strings inside the worker. This makes it impossible to test or iterate on prompts without redeploying the backend code.

## 3. Reliability & Maintenance
**Rating:** 2/10 (Downgraded)
-   **Critical Issues:**
    -   **Zero Tests:** There are still **0** test files (`*.test.ts`, `*.spec.ts`) in the entire project.
    -   **No Linting:** `eslint` is still missing from `package.json` dependencies. There is no automated way to catch the type mismatch or other errors.
    -   **Conflicting AI Instructions:** The system prompt contains contradictory instructions (e.g., "ALWAYS ask questions" vs "Use smart defaults"), leading to inconsistent AI behavior.

## 4. Security
**Rating:** 6/10
-   **Concerns:**
    -   **CORS:** The worker still allows `Access-Control-Allow-Origin: *`.
    -   **Input Validation:** Still relying on basic checks. No `zod` or runtime validation schema.

## Recommendations

### Immediate Priority (Stop Everything Else)
1.  **Fix Type Mismatch:**
    -   Delete the inline `ChatRequest` interface in `apps/worker/src/index.ts`.
    -   Import `ChatRequest` from `@chatkin/types`.
    -   Update the worker logic to match the shared type (decide on snake_case vs camelCase and stick to it).
2.  **Refactor Worker (For Real):**
    -   Move tool definitions to `apps/worker/src/ai/tools.ts`.
    -   Move system prompt construction to `apps/worker/src/ai/prompts.ts`.
    -   Move file upload logic to `apps/worker/src/uploads/handler.ts`.
    -   Keep `index.ts` as a thin router.

### High Priority
3.  **Add ESLint:** Install and configure ESLint to catch basic errors.
4.  **Add ONE Test:** Set up `vitest` and write a single unit test for the `systemPrompt` generation logic. This breaks the seal and makes adding more tests easier.

### Long Term
5.  **AI "Consultant" Flow:** Implement the "Classification Matrix" logic (Simple vs Complex) to fix the inconsistent AI behavior.
