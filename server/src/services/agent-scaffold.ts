import fs from "node:fs";
import path from "node:path";

const DEFAULT_AGENTS_MD = `# AGENTS.md

You are {agentName}.

## Role
{role}

## References

These files are essential. Read them.

- \`$AGENT_HOME/HEARTBEAT.md\` -- execution and extraction checklist. Run every heartbeat.
- \`$AGENT_HOME/SOUL.md\` -- who you are and how you should act.
- \`$AGENT_HOME/TOOLS.md\` -- tools you have access to
`;

const DEFAULT_HEARTBEAT_MD = `# HEARTBEAT.md -- {agentName} Heartbeat Checklist

Run this checklist on every heartbeat. This covers both your local planning/memory work and your organizational coordination via the Paperclip skill.

## 1. Identity and Context

- \`GET /api/agents/me\` -- confirm your id, role, budget, chainOfCommand.
- Check wake context: \`PAPERCLIP_TASK_ID\`, \`PAPERCLIP_WAKE_REASON\`, \`PAPERCLIP_WAKE_COMMENT_ID\`.

## 2. Local Planning Check

1. Read today's plan from \`$AGENT_HOME/memory/YYYY-MM-DD.md\` under "## Today's Plan".
2. Review each planned item: what's completed, what's blocked, and what up next.
3. For any blockers, resolve them yourself or escalate to the board.
4. If you're ahead, start on the next highest priority.
5. **Record progress updates** in the daily notes.

## 3. Approval Follow-Up

If \`PAPERCLIP_APPROVAL_ID\` is set:

- Review the approval and its linked issues.
- Close resolved issues or comment on what remains open.

## 4. Get Assignments

- \`GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked\`
- Prioritize: \`in_progress\` first, then \`todo\`. Skip \`blocked\` unless you can unblock it.
- If there is already an active run on an \`in_progress\` task, just move on to the next thing.
- If \`PAPERCLIP_TASK_ID\` is set and assigned to you, prioritize that task.

## 5. Checkout and Work

- Always checkout before working: \`POST /api/issues/{id}/checkout\`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work. Update status and comment when done.

## 6. Fact Extraction

1. Check for new conversations since last extraction.
2. Extract durable facts to the relevant entity in \`$AGENT_HOME/life/\` (PARA).
3. Update \`$AGENT_HOME/memory/YYYY-MM-DD.md\` with timeline entries.

## 7. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.
`;

const DEFAULT_SOUL_MD = `# SOUL.md -- {agentName} Persona

You are {agentName}.

## Role Context

Role: {role}
Title: {title}

## Core Principles

- Follow your assigned role and responsibilities.
- Use the Paperclip skill for organizational coordination.
- Maintain your memory in \`$AGENT_HOME/memory/\` and \`$AGENT_HOME/life/\`.
- Execute heartbeats efficiently and exit cleanly.
- Escalate blockers up your chain of command.

## Voice and Tone

- Be direct and clear.
- Lead with the point, then give context.
- Match intensity to stakes.
- Own uncertainty when it exists.
- Keep praise specific and rare.
`;

const DEFAULT_TOOLS_MD = `# Tools

(Your tools will go here. Add notes about them as you acquire and use them.)
`;

export interface ScaffoldAgentOptions {
  agentName: string;
  role: string;
  title?: string | null;
  instructionsFilePath: string;
}

export function scaffoldAgentDirectory(options: ScaffoldAgentOptions): {
  success: boolean;
  error?: string;
  createdPaths: string[];
} {
  const { agentName, role, title, instructionsFilePath } = options;
  const createdPaths: string[] = [];

  try {
    // Get the agent home directory from instructionsFilePath
    // instructionsFilePath is like: /path/to/agents/agentname/AGENTS.md
    const agentHome = path.dirname(instructionsFilePath);
    const agentBaseName = path.basename(agentHome);

    // Create agent directory if it doesn't exist
    if (!fs.existsSync(agentHome)) {
      fs.mkdirSync(agentHome, { recursive: true });
      createdPaths.push(agentHome);
    }

    // Create memory directory
    const memoryDir = path.join(agentHome, "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
      createdPaths.push(memoryDir);
    }

    // Create life directory
    const lifeDir = path.join(agentHome, "life");
    if (!fs.existsSync(lifeDir)) {
      fs.mkdirSync(lifeDir, { recursive: true });
      createdPaths.push(lifeDir);
    }

    // Template variables
    const templateVars: Record<string, string> = {
      "{agentName}": agentName,
      "{role}": role,
      "{title}": title || agentName,
    };

    // Helper to replace template variables
    const applyTemplate = (content: string): string => {
      let result = content;
      for (const [key, value] of Object.entries(templateVars)) {
        result = result.replaceAll(key, value);
      }
      return result;
    };

    // Create AGENTS.md
    const agentsMdPath = path.join(agentHome, "AGENTS.md");
    if (!fs.existsSync(agentsMdPath)) {
      fs.writeFileSync(agentsMdPath, applyTemplate(DEFAULT_AGENTS_MD), "utf-8");
      createdPaths.push(agentsMdPath);
    }

    // Create HEARTBEAT.md
    const heartbeatMdPath = path.join(agentHome, "HEARTBEAT.md");
    if (!fs.existsSync(heartbeatMdPath)) {
      fs.writeFileSync(heartbeatMdPath, applyTemplate(DEFAULT_HEARTBEAT_MD), "utf-8");
      createdPaths.push(heartbeatMdPath);
    }

    // Create SOUL.md
    const soulMdPath = path.join(agentHome, "SOUL.md");
    if (!fs.existsSync(soulMdPath)) {
      fs.writeFileSync(soulMdPath, applyTemplate(DEFAULT_SOUL_MD), "utf-8");
      createdPaths.push(soulMdPath);
    }

    // Create TOOLS.md
    const toolsMdPath = path.join(agentHome, "TOOLS.md");
    if (!fs.existsSync(toolsMdPath)) {
      fs.writeFileSync(toolsMdPath, applyTemplate(DEFAULT_TOOLS_MD), "utf-8");
      createdPaths.push(toolsMdPath);
    }

    return { success: true, createdPaths };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      createdPaths,
    };
  }
}

export function getInstructionsFilePath(
  adapterConfig: Record<string, unknown> | null | undefined,
  adapterType: string | null | undefined,
): string | null {
  if (!adapterConfig || typeof adapterConfig !== "object") return null;

  // Check known instructions path keys
  const pathKeys = ["instructionsFilePath", "agentsMdPath"];
  for (const key of pathKeys) {
    const value = adapterConfig[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}
