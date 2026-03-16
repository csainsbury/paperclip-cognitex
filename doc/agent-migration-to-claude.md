# Agent Migration: opencode_local → claude_local

**Date:** 2026-03-16
**Status:** Complete and verified

## Background

All 4 Paperclip agents (CEO, FoundingEngineer, Engineer2, ChiefStrategist) were running on the `opencode_local` adapter using Together AI's Kimi-K2.5 model. This setup had two critical problems:

1. **opencode binary broken** — The `opencode` CLI hangs on every command on this system. We had a fragile workaround (commenting out `ensureOpenCodeModelConfiguredAndAvailable` in `packages/adapters/opencode-local/src/server/execute.ts`), but it was a source-level hack that would break on upstream updates.

2. **tsx watch kills agents** — Agents editing server source files trigger the dev server's `tsx watch` auto-restart, which kills the agent's own process mid-run. This caused frequent failures and downtime.

## What Changed

### Adapter Migration

| Agent | Before | After |
|-------|--------|-------|
| CEO | opencode_local / Kimi-K2.5 | claude_local / claude-sonnet-4-6 |
| FoundingEngineer | opencode_local / Kimi-K2.5 | claude_local / claude-sonnet-4-6 |
| Engineer2 | opencode_local / Kimi-K2.5 | paused (no change) |
| ChiefStrategist | opencode_local / Kimi-K2.5 | paused (no change) |

### Worktree Isolation

The FoundingEngineer now runs in a **git worktree** under `.paperclip/worktrees/`. This means:

- Engineer edits happen in an isolated copy of the repo
- The main working tree and dev server are untouched
- The engineer commits to a feature branch and pushes it
- No more tsx watch crashes

The CEO runs in the main working tree (it coordinates, doesn't write code).

### Instruction File Updates

- `agents/ceo/AGENTS.md` — Added Claude Code awareness, clarified "do not write code" role
- `agents/ceo/HEARTBEAT.md` — Replaced tsx-watch code safety section with a simpler "delegate to engineers" rule
- `agents/engineer/AGENTS.md` — Added worktree awareness and push workflow
- `agents/engineer/HEARTBEAT.md` — Simplified code safety (worktree eliminates crash risk), added "commit and push" to exit checklist

### Opencode Bypass Reverted

The commented-out `ensureOpenCodeModelConfiguredAndAvailable` call in `packages/adapters/opencode-local/src/server/execute.ts` was restored to upstream state. No more source-level hacks in `packages/`.

## Infrastructure Setup

### Project and Workspace

For worktree creation to work, issues must be linked to a project that has a workspace with a local `cwd`. We created:

- **Project** "paperclip" (`772e3951-db69-45fa-a8f6-f77991927161`)
- **Workspace** (`d0fe750b-58cc-45f4-abe5-dda5d92982e0`) with `cwd: /home/chris/paperclip`

**Important:** When creating issues for the engineer, always set `projectId` to `772e3951-db69-45fa-a8f6-f77991927161`. Without this, the workspace resolver falls back to a non-git directory and worktree creation fails with "not a git repository".

### Agent Configuration Details

**CEO** (`60d1f052-6b4a-43d3-89c8-6f726f5a1344`):
```json
{
  "adapterType": "claude_local",
  "adapterConfig": {
    "cwd": "/home/chris/paperclip",
    "model": "claude-sonnet-4-6",
    "effort": "medium",
    "maxTurnsPerRun": 30,
    "dangerouslySkipPermissions": true,
    "instructionsFilePath": "/home/chris/paperclip/agents/ceo/AGENTS.md"
  }
}
```

**FoundingEngineer** (`0d7993e4-8f5d-46b1-93ec-9fe83724c700`):
```json
{
  "adapterType": "claude_local",
  "adapterConfig": {
    "cwd": "/home/chris/paperclip",
    "model": "claude-sonnet-4-6",
    "effort": "high",
    "maxTurnsPerRun": 50,
    "dangerouslySkipPermissions": true,
    "instructionsFilePath": "/home/chris/paperclip/agents/engineer/AGENTS.md",
    "workspaceStrategy": {
      "type": "git_worktree",
      "branchTemplate": "agent/{{agent.name}}/{{issue.identifier}}-{{slug}}",
      "worktreeParentDir": "/home/chris/paperclip/.paperclip/worktrees"
    }
  }
}
```

### Key API Endpoints

- Wake agent: `POST /api/agents/{id}/wakeup` (not `/wake`)
- Update agent: `PATCH /api/agents/{id}` (not under `/companies/`)
- Reset session: `POST /api/agents/{id}/runtime-state/reset-session`
- Check run: `GET /api/heartbeat-runs/{runId}`
- Push to remote: `git push cognitex master` (not `origin`)

## Gotchas and Lessons Learned

1. **Session ID format mismatch** — After switching adapters, the old opencode session IDs (format: `ses_...`) are incompatible with Claude CLI (expects UUIDs). Fix: reset the session via `/runtime-state/reset-session` before the first wake on the new adapter.

2. **Workspace resolution requires project linkage** — The `resolveWorkspaceForRun` function in `heartbeat.ts` resolves the CWD by looking up the issue's project workspace, NOT from the adapter's `cwd` config. If an issue has no `projectId`, or the project has no workspace with a valid `cwd`, it falls back to a generic directory that is not a git repo, and worktree creation fails.

3. **Wakeup payload uses `issueId` not `taskId`** — The `enrichWakeContextSnapshot` function reads `payload.issueId` to set the context. Using `taskId` in the payload does not wire up project/workspace resolution.

4. **`.paperclip/` already in .gitignore** — Was added before this migration, so worktree directories don't pollute git status.

## Cost

Claude Sonnet API costs more than Together AI's Kimi-K2.5:
- Empty heartbeats: ~$0.01-0.02 per run
- Active work runs: ~$0.10-0.50 per run
- Monitor via `spentMonthlyCents` field; set `budgetMonthlyCents` if needed

## Reactivating Paused Agents

If Engineer2 or ChiefStrategist are needed again:
```
PATCH /api/agents/{id} → {"status": "idle", "adapterType": "claude_local", "adapterConfig": {...}}
POST /api/agents/{id}/runtime-state/reset-session → {}
```

Remember to reset their sessions since they still have opencode session IDs.
