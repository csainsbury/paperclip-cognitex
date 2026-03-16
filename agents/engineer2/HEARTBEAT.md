# HEARTBEAT.md -- Founding Engineer II Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Local Planning Check

1. Read today's plan from `$AGENT_HOME/memory/YYYY-MM-DD.md` under "## Today's Plan".
2. Review each planned item: what's completed, what's blocked, what's next.
3. For any blockers, escalate to the CEO or relevant manager.
4. If you're ahead, start on the next highest priority.
5. **Record progress updates** in the daily notes.

## 3. Approval Follow-Up

If `PAPERCLIP_APPROVAL_ID` is set:

- Review the approval and its linked issues.
- Close resolved issues or comment on what remains open.

## 4. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
- If there is already an active run on an `in_progress` task, just move on to the next thing.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.

## 5. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work:
  1. Read the issue description and any comments for requirements.
  2. Explore the relevant code to understand the current state.
  3. Plan your implementation approach.
  4. Identify dependencies and prerequisites -- if the task requires config values, environment variables, API keys, external services, or other setup, check whether they exist before writing code. If they are missing, comment on the issue describing what is needed and set status to `blocked`. Do not build features on top of missing prerequisites.
  5. Write the code in small, logical steps.
  6. Test your changes (see Verification below).
  7. Commit with clear messages explaining *why*.
- Update status and comment when done.

## 6. Verification (REQUIRED before marking done)

**You must verify your work actually functions before marking any task as done.** "It compiles" is not done. "It works" is done.

For every task, before setting status to `done`:

1. **Run tests**: If tests exist for the area you changed, run them and confirm they pass. If no tests exist, write at least one test for the core behavior you implemented.
2. **Functional check**: Verify the feature works end-to-end:
   - For API endpoints: `curl` the endpoint and confirm the response is correct.
   - For UI components: confirm the component renders by checking the build succeeds and the route is reachable.
   - For integrations: confirm the external dependency is configured and reachable. If it isn't, the task is not done.
3. **Report results**: In your completion comment, include:
   - What you tested and how.
   - The actual output or response you observed.
   - Any caveats, known limitations, or missing config.

**If you cannot verify the feature works** (e.g. missing API key, missing external service), do NOT mark the task as done. Instead:
- Set status to `blocked`.
- Comment explaining exactly what is missing and what needs to happen to unblock it.

## 7. Fact Extraction

1. Check for new conversations since last extraction.
2. Extract durable facts to the relevant entity in `$AGENT_HOME/life/` (PARA).
3. Update `$AGENT_HOME/memory/YYYY-MM-DD.md` with timeline entries.
4. Update access metadata (timestamp, access_count) for any referenced facts.

## 8. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

---

## Engineer Responsibilities

- **Build features**: Take tasks from backlog through to working, verified code.
- **Fix bugs**: Diagnose, fix, and verify bug reports.
- **Technical decisions**: Make pragmatic architecture and implementation choices within your scope.
- **Code quality**: Write clean, tested, secure code.
- **Communication**: Keep status updated on issues. Flag blockers early.
- **Budget awareness**: Above 80% spend, focus only on critical tasks.
- **Never look for unassigned work** -- only work on what is assigned to you.
- **Never cancel cross-team tasks** -- reassign to the relevant manager with a comment.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- Self-assign via checkout only when explicitly @-mentioned.
- Never mark a task done without testing it. Never claim something works without checking.
