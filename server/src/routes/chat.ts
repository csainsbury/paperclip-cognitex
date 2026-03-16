import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logActivity } from "../services/index.js";
import { logger } from "../middleware/logger.js";
import { issueService } from "../services/issues.js";
import { eq, and, desc } from "drizzle-orm";
import { issueComments, issues, agents, authUsers, companies } from "@paperclipai/db";

const sendMessageSchema = z.object({
  text: z.string().min(1),
  companyId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
});

const getMessagesSchema = z.object({
  companyId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export function chatRoutes(db: Db) {
  const router = Router();
  const svc = issueService(db);

  // Get chat messages (uses issue comments as the backing store)
  router.get("/chat/messages", async (req, res) => {
    assertBoard(req);
    const { companyId, issueId, limit } = req.query as unknown as z.infer<typeof getMessagesSchema>;
    assertCompanyAccess(req, companyId);

    try {
      const whereClause = issueId
        ? and(
            eq(issueComments.companyId, companyId),
            eq(issueComments.issueId, issueId)
          )
        : eq(issueComments.companyId, companyId);

      const rows = await db
        .select({
          id: issueComments.id,
          text: issueComments.body,
          authorAgentId: issueComments.authorAgentId,
          authorUserId: issueComments.authorUserId,
          createdAt: issueComments.createdAt,
          issueId: issueComments.issueId,
        })
        .from(issueComments)
        .where(whereClause)
        .orderBy(desc(issueComments.createdAt))
        .limit(limit);

      // Format messages for chat interface
      const messages = await Promise.all(
        rows.map(async (row) => {
          let author = "Unknown";
          let authorType = "system";

          if (row.authorUserId) {
            const user = await db.query.authUsers.findFirst({
              where: eq(authUsers.id, row.authorUserId),
            });
            author = user?.name || user?.email || "User";
            authorType = "user";
          } else if (row.authorAgentId) {
            const agent = await db.query.agents.findFirst({
              where: eq(agents.id, row.authorAgentId),
            });
            author = agent?.name || agent?.title || "Agent";
            authorType = "agent";
          }

          return {
            id: row.id,
            text: row.text,
            author,
            authorType,
            timestamp: row.createdAt,
            issueId: row.issueId,
          };
        })
      );

      // Reverse to show oldest first
      res.json(messages.reverse());
    } catch (err) {
      logger.error({ err, companyId }, "Failed to load chat messages");
      res.status(500).json({ error: "Failed to load messages" });
    }
  });

  // Send a chat message (creates an issue comment)
  router.post("/chat/messages", validate(sendMessageSchema), async (req, res) => {
    assertBoard(req);
    const { text, companyId, issueId } = req.body;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "User authentication required" });
      return;
    }

    try {
      // If no specific issue ID provided, find or create a general chat issue
      let targetIssueId = issueId;
      
      if (!targetIssueId) {
        // Look for an existing chat issue
        const existingChat = await db.query.issues.findFirst({
          where: and(
            eq(issues.companyId, companyId),
            eq(issues.title, "Chat Messages")
          ),
        });

        if (existingChat) {
          targetIssueId = existingChat.id;
        } else {
          // Create a new chat issue
          const [newIssue] = await db
            .insert(issues)
            .values({
              companyId,
              title: "Chat Messages",
              description: "General chat messages from the chat interface",
              status: "in_progress",
              priority: "low",
              createdByUserId: userId,
            })
            .returning();
          
          targetIssueId = newIssue.id;

          await logActivity(db, {
            companyId,
            actorType: "user",
            actorId: userId,
            action: "issue.created",
            entityType: "issue",
            entityId: targetIssueId,
            details: { title: "Chat Messages" },
          });
        }
      }

      // Create the comment
      const [comment] = await db
        .insert(issueComments)
        .values({
          companyId,
          issueId: targetIssueId,
          authorUserId: userId,
          body: text,
        })
        .returning();

      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: userId,
        action: "issue.comment.created",
        entityType: "issue",
        entityId: targetIssueId,
        details: { commentId: comment.id },
      });

      // Get author info
      const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userId),
      });

      res.status(201).json({
        id: comment.id,
        text: comment.body,
        author: user?.name || user?.email || "User",
        authorType: "user",
        timestamp: comment.createdAt,
        issueId: targetIssueId,
      });
    } catch (err) {
      logger.error({ err, companyId, userId }, "Failed to send chat message");
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  return router;
}
