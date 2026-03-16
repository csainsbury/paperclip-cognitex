import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { telegramApi } from "../api/telegram";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Field, HintIcon } from "./agent-config-primitives";
import { Check, Send, MessageCircle, Trash2, Copy, CheckCircle2, AlertCircle } from "lucide-react";

interface TelegramSettingsProps {
  companyId: string;
}

export function TelegramSettings({ companyId }: TelegramSettingsProps) {
  const queryClient = useQueryClient();

  // Form state
  const [chatId, setChatId] = useState("");
  const [username, setUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  // Query for current settings
  const settingsQuery = useQuery({
    queryKey: queryKeys.telegram.settings(companyId),
    queryFn: () => telegramApi.getSettings(companyId),
    enabled: !!companyId,
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: (data: { telegramChatId: string; telegramUsername?: string }) =>
      telegramApi.link(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.telegram.settings(companyId) });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (code: string) => telegramApi.verify(companyId, { verificationCode: code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.telegram.settings(companyId) });
      setVerificationCode("");
    },
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: () => telegramApi.unlink(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.telegram.settings(companyId) });
      setChatId("");
      setUsername("");
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (message?: string) => telegramApi.test(companyId, message ? { message } : undefined),
  });

  const handleLink = () => {
    if (!chatId.trim()) return;
    linkMutation.mutate({
      telegramChatId: chatId.trim(),
      telegramUsername: username.trim() || undefined,
    });
  };

  const handleVerify = () => {
    if (!verificationCode.trim()) return;
    verifyMutation.mutate(verificationCode.trim());
  };

  const handleCopyCode = async () => {
    if (linkMutation.data?.verificationCode) {
      try {
        await navigator.clipboard.writeText(linkMutation.data.verificationCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch {
        // clipboard may not be available
      }
    }
  };

  const handleUnlink = () => {
    if (window.confirm("Are you sure you want to unlink your Telegram account?")) {
      unlinkMutation.mutate();
    }
  };

  const handleTest = () => {
    testMutation.mutate(testMessage.trim() || undefined);
  };

  const settings = settingsQuery.data;
  const isLinked = settings?.isLinked ?? false;
  const isActive = settings?.isActive ?? false;

  // Not linked - show link form
  if (!isLinked) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            Link your Telegram account to receive notifications.
          </span>
          <HintIcon text="Enter your Telegram chat ID and optional username to link your account." />
        </div>

        <div className="space-y-3">
          <Field
            label="Telegram Chat ID"
            hint="Your Telegram chat ID (e.g., 123456789). Get this from @userinfobot."
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789"
            />
          </Field>

          <Field
            label="Telegram Username (optional)"
            hint="Your Telegram username without @ (e.g., johndoe)."
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
            />
          </Field>
        </div>

        {linkMutation.data?.verificationCode && (
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">Account linked!</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this verification code to the Paperclip bot to complete setup:
            </p>
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                {linkMutation.data.verificationCode}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyCode}
                className="h-7 px-2"
              >
                {copiedCode ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        )}

        {linkMutation.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {linkMutation.error instanceof Error
              ? linkMutation.error.message
              : "Failed to link account"}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleLink}
            disabled={linkMutation.isPending || !chatId.trim()}
          >
            {linkMutation.isPending ? "Linking..." : "Link Telegram Account"}
          </Button>
        </div>
      </div>
    );
  }

  // Linked but not verified - show verification form
  if (isLinked && !isActive) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="font-medium">Account linked but not verified</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Enter the verification code you received from the Paperclip bot to complete setup.
        </p>

        <Field label="Verification Code" hint="6-digit code from Telegram">
          <input
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
        </Field>

        {verifyMutation.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {verifyMutation.error instanceof Error
              ? verifyMutation.error.message
              : "Invalid verification code"}
          </div>
        )}

        {verifyMutation.isSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Account verified successfully!
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleVerify}
            disabled={verifyMutation.isPending || verificationCode.length !== 6}
          >
            {verifyMutation.isPending ? "Verifying..." : "Verify"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUnlink}
            disabled={unlinkMutation.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Unlink
          </Button>
        </div>
      </div>
    );
  }

  // Linked and verified - show active status and controls
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="font-medium">Telegram connected</span>
        {settings?.telegramUsername && (
          <span className="text-muted-foreground">@{settings.telegramUsername}</span>
        )}
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Test Notification
        </div>
        <Field label="Message (optional)" hint="Custom message to send for testing">
          <input
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Test message..."
          />
        </Field>

        {testMutation.isSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Test notification sent!
          </div>
        )}

        {testMutation.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {testMutation.error instanceof Error
              ? testMutation.error.message
              : "Failed to send test"}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            <Send className="h-3 w-3 mr-1" />
            {testMutation.isPending ? "Sending..." : "Send Test"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleUnlink}
          disabled={unlinkMutation.isPending}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Unlink Telegram Account
        </Button>
      </div>
    </div>
  );
}
