# Telegram Integration Project

## Overview
Built Telegram bot integration for Paperclip to enable inbox notifications and two-way chat capabilities.

## Key Components

### Webhook Handler
- Endpoint: `POST /api/telegram/webhook/:companyId`
- No auth required (called by Telegram servers)
- Processes incoming messages asynchronously
- Acknowledges receipt immediately (required by Telegram API)

### Bot Commands
- `/inbox` - Shows user's assigned issues (todo, in_progress, blocked)
- `/help` - Displays available commands

### Notification System
- Triggers on issue assignment to users
- Sends via `sendInboxNotification()` function
- Includes: issue identifier, title, status, priority
- Links back to Paperclip UI
- Gracefully handles missing bot token or unlinked users

### User Authentication Flow
1. User links Telegram account in Paperclip settings
2. System generates verification code
3. User sends code to Telegram bot
4. Account activated for notifications

## Technical Details

### Environment Variables
- `TELEGRAM_BOT_TOKEN` - Required for bot functionality

### Database Schema
- `user_telegram_settings` table stores:
  - companyId, userId (unique composite key)
  - telegramChatId, telegramUsername
  - isActive, verificationCode, verifiedAt

### Files Modified
- `server/src/routes/telegram.ts` - Webhook and notification functions
- `server/src/routes/issues.ts` - Integration points for assignment notifications
- `server/src/app.ts` - Pass bot token to routes

## Integration Points
- Issue creation: sends notification if assigneeUserId set
- Issue update: sends notification on assignee change
- Only sends if status !== "backlog"
- Non-blocking (uses void + catch pattern)

## Future Enhancements
- Support for replying to notifications
- Two-way chat with agents
- Notification preferences per user
- Support for different notification types (mentions, status changes)
