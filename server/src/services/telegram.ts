import type { Db } from "@paperclipai/db";
import { userTelegramSettings, telegramConversations } from "@paperclipai/db";
import { eq, and, desc } from "drizzle-orm";

export interface TelegramSettings {
  id: string;
  companyId: string;
  userId: string;
  telegramChatId: string;
  telegramUsername: string | null;
  isActive: boolean;
  verificationCode: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramConversation {
  id: string;
  companyId: string;
  userId: string;
  agentId: string | null;
  telegramChatId: string;
  status: "active" | "paused" | "closed";
  context: string | null;
  lastMessageAt: Date | null;
  lastMessageBy: "user" | "agent" | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramNotificationPayload {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  disableNotification?: boolean;
}

export function telegramService(db: Db) {
  const generateVerificationCode = (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  return {
    async getSettings(companyId: string, userId: string): Promise<TelegramSettings | null> {
      const result = await db.query.userTelegramSettings.findFirst({
        where: and(
          eq(userTelegramSettings.companyId, companyId),
          eq(userTelegramSettings.userId, userId),
        ),
      });
      return result ?? null;
    },

    async createSettings(
      companyId: string,
      userId: string,
      telegramChatId: string,
      telegramUsername?: string,
    ): Promise<TelegramSettings> {
      const verificationCode = generateVerificationCode();
      
      const [result] = await db
        .insert(userTelegramSettings)
        .values({
          companyId,
          userId,
          telegramChatId,
          telegramUsername: telegramUsername ?? null,
          verificationCode,
          isActive: false,
        })
        .onConflictDoUpdate({
          target: [userTelegramSettings.companyId, userTelegramSettings.userId],
          set: {
            telegramChatId,
            telegramUsername: telegramUsername ?? null,
            verificationCode,
            isActive: false,
            updatedAt: new Date(),
          },
        })
        .returning();

      return result;
    },

    async verifySettings(companyId: string, userId: string, code: string): Promise<TelegramSettings | null> {
      const settings = await db.query.userTelegramSettings.findFirst({
        where: and(
          eq(userTelegramSettings.companyId, companyId),
          eq(userTelegramSettings.userId, userId),
        ),
      });

      if (!settings || settings.verificationCode !== code) {
        return null;
      }

      const [result] = await db
        .update(userTelegramSettings)
        .set({
          isActive: true,
          verifiedAt: new Date(),
          verificationCode: null,
          updatedAt: new Date(),
        })
        .where(eq(userTelegramSettings.id, settings.id))
        .returning();

      return result;
    },

    async deleteSettings(companyId: string, userId: string): Promise<boolean> {
      const result = await db
        .delete(userTelegramSettings)
        .where(
          and(
            eq(userTelegramSettings.companyId, companyId),
            eq(userTelegramSettings.userId, userId),
          ),
        )
        .returning();

      return result.length > 0;
    },

    async getActiveSettingsForUser(companyId: string, userId: string): Promise<TelegramSettings | null> {
      const result = await db.query.userTelegramSettings.findFirst({
        where: and(
          eq(userTelegramSettings.companyId, companyId),
          eq(userTelegramSettings.userId, userId),
          eq(userTelegramSettings.isActive, true),
        ),
      });
      return result ?? null;
    },

    async getSettingsByChatId(companyId: string, chatId: string): Promise<TelegramSettings | null> {
      const result = await db.query.userTelegramSettings.findFirst({
        where: and(
          eq(userTelegramSettings.companyId, companyId),
          eq(userTelegramSettings.telegramChatId, chatId),
        ),
      });
      return result ?? null;
    },

    // Conversation management
    async getActiveConversation(companyId: string, userId: string): Promise<TelegramConversation | null> {
      const result = await db.query.telegramConversations.findFirst({
        where: and(
          eq(telegramConversations.companyId, companyId),
          eq(telegramConversations.userId, userId),
          eq(telegramConversations.status, "active"),
        ),
        orderBy: desc(telegramConversations.updatedAt),
      });
      return result as TelegramConversation | null;
    },

    async getConversationByChatId(companyId: string, chatId: string): Promise<TelegramConversation | null> {
      const result = await db.query.telegramConversations.findFirst({
        where: and(
          eq(telegramConversations.companyId, companyId),
          eq(telegramConversations.telegramChatId, chatId),
          eq(telegramConversations.status, "active"),
        ),
        orderBy: desc(telegramConversations.updatedAt),
      });
      return result as TelegramConversation | null;
    },

    async createConversation(
      companyId: string,
      userId: string,
      telegramChatId: string,
      agentId?: string,
      context?: string,
    ): Promise<TelegramConversation> {
      const [result] = await db
        .insert(telegramConversations)
        .values({
          companyId,
          userId,
          telegramChatId,
          agentId: agentId ?? null,
          status: "active",
          context: context ?? null,
          lastMessageAt: new Date(),
          lastMessageBy: agentId ? "agent" : null,
        })
        .returning();
      return result as TelegramConversation;
    },

    async updateConversation(
      conversationId: string,
      updates: { status?: "active" | "paused" | "closed"; context?: string; lastMessageBy?: "user" | "agent" },
    ): Promise<TelegramConversation | null> {
      const [result] = await db
        .update(telegramConversations)
        .set({
          ...updates,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(telegramConversations.id, conversationId))
        .returning();
      return result as TelegramConversation | null;
    },

    async closeConversation(conversationId: string): Promise<boolean> {
      const result = await db
        .update(telegramConversations)
        .set({
          status: "closed",
          updatedAt: new Date(),
        })
        .where(eq(telegramConversations.id, conversationId))
        .returning();
      return result.length > 0;
    },

    async getUserActiveConversations(companyId: string, userId: string): Promise<TelegramConversation[]> {
      const result = await db.query.telegramConversations.findMany({
        where: and(
          eq(telegramConversations.companyId, companyId),
          eq(telegramConversations.userId, userId),
          eq(telegramConversations.status, "active"),
        ),
        orderBy: desc(telegramConversations.updatedAt),
      });
      return result as TelegramConversation[];
    },
  };
}

export async function sendTelegramNotification(
  botToken: string,
  payload: TelegramNotificationPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: payload.chatId,
      text: payload.text,
    };

    if (payload.parseMode) {
      body.parse_mode = payload.parseMode;
    }

    if (payload.disableNotification !== undefined) {
      body.disable_notification = payload.disableNotification;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Telegram API error: ${error}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
