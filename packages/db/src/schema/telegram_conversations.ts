import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const telegramConversations = pgTable(
  "telegram_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    agentId: uuid("agent_id").references(() => agents.id),
    telegramChatId: text("telegram_chat_id").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, paused, closed
    context: text("context"), // JSON string for conversation context
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessageBy: varchar("last_message_by", { length: 10 }), // 'user' or 'agent'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("telegram_conversations_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
    companyAgentIdx: index("telegram_conversations_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
    chatIdx: index("telegram_conversations_chat_idx").on(
      table.telegramChatId,
    ),
    statusIdx: index("telegram_conversations_status_idx").on(
      table.status,
    ),
    activeConvIdx: uniqueIndex("telegram_conversations_active_idx").on(
      table.companyId,
      table.userId,
      table.status,
    ),
  }),
);
