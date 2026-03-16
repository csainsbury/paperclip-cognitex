CREATE TABLE "user_telegram_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"telegram_username" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"verification_code" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_telegram_settings" ADD CONSTRAINT "user_telegram_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_telegram_settings_company_user_idx" ON "user_telegram_settings" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_telegram_settings_company_chat_idx" ON "user_telegram_settings" USING btree ("company_id","telegram_chat_id");--> statement-breakpoint
CREATE INDEX "user_telegram_settings_company_idx" ON "user_telegram_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "user_telegram_settings_user_idx" ON "user_telegram_settings" USING btree ("user_id");