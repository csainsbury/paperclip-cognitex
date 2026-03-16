import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const userTelegramSettings = pgTable(
  "user_telegram_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramUsername: text("telegram_username"),
    isActive: boolean("is_active").notNull().default(true),
    verificationCode: text("verification_code"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: uniqueIndex("user_telegram_settings_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
    companyChatIdx: uniqueIndex("user_telegram_settings_company_chat_idx").on(
      table.companyId,
      table.telegramChatId,
    ),
    companyIdx: index("user_telegram_settings_company_idx").on(table.companyId),
    userIdx: index("user_telegram_settings_user_idx").on(table.userId),
  }),
);
