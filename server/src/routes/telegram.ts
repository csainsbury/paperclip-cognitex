import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { telegramService, sendTelegramNotification } from "../services/telegram.js";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logActivity, issueService } from "../services/index.js";
import { logger } from "../middleware/logger.js";

const linkTelegramSchema = z.object({
  telegramChatId: z.string().min(1),
  telegramUsername: z.string().optional(),
});

const verifyTelegramSchema = z.object({
  verificationCode: z.string().length(6),
});

const sendTestNotificationSchema = z.object({
  message: z.string().optional(),
});

const telegramWebhookSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      username: z.string().optional(),
    }),
    chat: z.object({
      id: z.number(),
      type: z.string(),
    }),
    date: z.number(),
    text: z.string().optional(),
  }).optional(),
});

export function telegramRoutes(db: Db, botToken?: string) {
  const router = Router();
  const svc = telegramService(db);

  router.get("/companies/:companyId/telegram/settings", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "User authentication required" });
      return;
    }

    const settings = await svc.getSettings(companyId, userId);
    res.json({
      isLinked: !!settings?.telegramChatId,
      isActive: settings?.isActive ?? false,
      telegramUsername: settings?.telegramUsername ?? null,
      verifiedAt: settings?.verifiedAt ?? null,
    });
  });

  router.post("/companies/:companyId/telegram/link", validate(linkTelegramSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "User authentication required" });
      return;
    }

    const { telegramChatId, telegramUsername } = req.body;
    const settings = await svc.createSettings(companyId, userId, telegramChatId, telegramUsername);

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: userId,
      action: "telegram.settings.linked",
      entityType: "user",
      entityId: userId,
      details: { telegramUsername },
    });

    res.status(201).json({
      id: settings.id,
      verificationCode: settings.verificationCode,
      message: "Telegram account linked. Please send the verification code to the bot to complete setup.",
    });
  });

  router.post("/companies/:companyId/telegram/verify", validate(verifyTelegramSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "User authentication required" });
      return;
    }

    const { verificationCode } = req.body;
    const settings = await svc.verifySettings(companyId, userId, verificationCode);

    if (!settings) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: userId,
      action: "telegram.settings.verified",
      entityType: "user",
      entityId: userId,
      details: { telegramUsername: settings.telegramUsername },
    });

    res.json({
      success: true,
      message: "Telegram account verified successfully.",
    });
  });

  router.delete("/companies/:companyId/telegram/link", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "User authentication required" });
      return;
    }

    const deleted = await svc.deleteSettings(companyId, userId);

    if (!deleted) {
      res.status(404).json({ error: "Telegram settings not found" });
      return;
    }

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: userId,
      action: "telegram.settings.unlinked",
      entityType: "user",
      entityId: userId,
    });

    res.json({ success: true });
  });

  router.post("/companies/:companyId/telegram/test", validate(sendTestNotificationSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "User authentication required" });
      return;
    }

    if (!botToken) {
      res.status(503).json({ error: "Telegram bot is not configured" });
      return;
    }

    const settings = await svc.getActiveSettingsForUser(companyId, userId);
    if (!settings || !settings.telegramChatId) {
      res.status(400).json({ error: "Telegram account not linked or not verified" });
      return;
    }

    const message = req.body.message ?? "🧪 Test notification from Paperclip!\n\nYour Telegram integration is working correctly.";
    const result = await sendTelegramNotification(botToken, {
      chatId: settings.telegramChatId,
      text: message,
      parseMode: "HTML",
    });

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  });

  // Webhook endpoint for incoming Telegram messages (no auth required - called by Telegram)
  router.post("/telegram/webhook/:companyId", async (req, res) => {
    const companyId = req.params.companyId as string;
    
    if (!botToken) {
      logger.warn({ companyId }, "Telegram webhook received but bot token not configured");
      res.status(503).json({ error: "Telegram bot not configured" });
      return;
    }

    const update = req.body;
    
    // Acknowledge receipt immediately (Telegram expects 200 OK quickly)
    res.json({ ok: true });

    // Process the update asynchronously
    if (update.message && update.message.text) {
      const chatId = String(update.message.chat.id);
      const text = update.message.text;
      const username = update.message.from?.username;
      
      logger.info({ companyId, chatId, username, text: text.substring(0, 100) }, "Telegram message received");

      // Find user by chat ID
      const settings = await svc.getSettingsByChatId(companyId, chatId);
      
      if (!settings) {
        // Unknown user - send setup instructions
        await sendTelegramNotification(botToken, {
          chatId,
          text: "👋 Hello! I'm the Paperclip bot.\n\nTo receive notifications, please link your Telegram account in your Paperclip settings.",
          parseMode: "HTML",
        });
        return;
      }

      if (!settings.isActive) {
        // User not verified yet
        await sendTelegramNotification(botToken, {
          chatId,
          text: `🔐 Please complete verification in Paperclip to activate notifications.`,
          parseMode: "HTML",
        });
        return;
      }

      // Handle commands
      if (text.startsWith("/")) {
        const command = text.split(" ")[0].toLowerCase();
        
        switch (command) {
          case "/inbox": {
            // Get user's assigned issues
            const issues = await issueService(db).list(companyId, {
              assigneeUserId: settings.userId,
              status: "todo,in_progress,blocked",
            });
            
            if (issues.length === 0) {
              await sendTelegramNotification(botToken, {
                chatId,
                text: "📭 Your inbox is empty!",
                parseMode: "HTML",
              });
            } else {
              const issueList = issues.slice(0, 5).map(i => 
                `• <b>${i.identifier}</b>: ${i.title} (${i.status})`
              ).join("\n");
              
              await sendTelegramNotification(botToken, {
                chatId,
                text: `📥 <b>Your Inbox</b> (${issues.length} items)\n\n${issueList}${issues.length > 5 ? "\n\n<i>And " + (issues.length - 5) + " more...</i>" : ""}`,
                parseMode: "HTML",
              });
            }
            break;
          }
          
          case "/help":
            await sendTelegramNotification(botToken, {
              chatId,
              text: "🤖 <b>Paperclip Bot Commands</b>\n\n/inbox - Show your assigned items\n/help - Show this help message\n\nYou'll automatically receive notifications when items are assigned to you.",
              parseMode: "HTML",
            });
            break;
            
          default:
            await sendTelegramNotification(botToken, {
              chatId,
              text: "❓ Unknown command. Try /help for available commands.",
              parseMode: "HTML",
            });
        }
        return;
      }

      // Non-command message - could be reply to notification
      // For now, just acknowledge receipt
      await sendTelegramNotification(botToken, {
        chatId,
        text: "✅ Message received. Use /inbox to see your tasks or /help for commands.",
        parseMode: "HTML",
      });
    }
  });

  return router;
}

// Helper function to send inbox notifications (called from issue service)
export async function sendInboxNotification(
  db: Db,
  botToken: string | undefined,
  companyId: string,
  userId: string,
  issue: { id: string; identifier: string; title: string; status: string; priority: string },
): Promise<void> {
  if (!botToken) {
    logger.debug({ companyId, userId }, "Skipping Telegram notification - bot token not configured");
    return;
  }

  const svc = telegramService(db);
  const settings = await svc.getActiveSettingsForUser(companyId, userId);
  
  if (!settings) {
    logger.debug({ companyId, userId }, "User has no active Telegram settings, skipping notification");
    return;
  }

  const priorityEmoji = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "⚪",
  }[issue.priority] || "⚪";

  const message = `${priorityEmoji} <b>New Item Assigned</b>\n\n<b>${issue.identifier}</b>: ${issue.title}\nStatus: ${issue.status}\nPriority: ${issue.priority}\n\n<a href=\"/KRE/issues/${issue.identifier}\">View in Paperclip</a>`;

  const result = await sendTelegramNotification(botToken, {
    chatId: settings.telegramChatId,
    text: message,
    parseMode: "HTML",
  });

  if (!result.success) {
    logger.error({ companyId, userId, error: result.error }, "Failed to send Telegram inbox notification");
  } else {
    logger.info({ companyId, userId, issueId: issue.id }, "Sent Telegram inbox notification");
  }
}
