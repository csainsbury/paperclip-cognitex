CREATE TABLE "telegram_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" uuid,
	"telegram_chat_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"context" text,
	"last_message_at" timestamp with time zone,
	"last_message_by" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_conversations" ADD CONSTRAINT "telegram_conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_conversations" ADD CONSTRAINT "telegram_conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_conversations_company_user_idx" ON "telegram_conversations" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "telegram_conversations_company_agent_idx" ON "telegram_conversations" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX "telegram_conversations_chat_idx" ON "telegram_conversations" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "telegram_conversations_status_idx" ON "telegram_conversations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_conversations_active_idx" ON "telegram_conversations" USING btree ("company_id","user_id","status");