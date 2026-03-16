import { useRef, useMemo, useState, useEffect } from "react";
import type { IssueComment, Agent } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, PaperclipIcon } from "lucide-react";
import { Identity } from "./Identity";
import { formatDateTime } from "../lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommentWithRunMeta extends IssueComment {
  runId?: string | null;
  runAgentId?: string | null;
}

interface IssueChatProps {
  comments: CommentWithRunMeta[];
  companyId: string;
  onSend: (body: string) => Promise<void>;
  agentMap: Map<string, Agent>;
  disabled?: boolean;
  imageUploadHandler?: (file: File) => Promise<string>;
}

function ChatMessage({
  comment,
  agentMap,
}: {
  comment: CommentWithRunMeta;
  agentMap: Map<string, Agent>;
}) {
  const author = comment.authorAgentId
    ? agentMap.get(comment.authorAgentId)
    : null;
  const authorName = author?.name ?? "Board";
  const isUser = comment.authorUserId !== null;
  const isAssistant = comment.authorAgentId !== null && !isUser;

  return (
    <div className={`flex gap-3 py-3 ${isUser ? "justify-end" : ""}`}>
      <div className={`flex gap-3 max-w-[85%] ${isUser ? "flex-row-reverse" : ""}`}>
        <div className="flex-shrink-0">
          {isUser ? (
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">U</span>
            </div>
          ) : isAssistant && author ? (
            <Identity name={authorName} size="sm" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-medium">?</span>
            </div>
          )}
        </div>
        <div className={`space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{authorName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(comment.createdAt)}
            </span>
          </div>
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            <div className="whitespace-pre-wrap">{comment.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssueChat({
  comments,
  companyId,
  onSend,
  agentMap,
  disabled,
  imageUploadHandler,
}: IssueChatProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort comments by creation time
  const sortedComments = useMemo(() => {
    return [...comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [comments]);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
      textareaRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[500px] border rounded-lg overflow-hidden">
      {/* Message list */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {sortedComments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-1">
            {sortedComments.map((comment) => (
              <ChatMessage
                key={comment.id}
                comment={comment}
                agentMap={agentMap}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3 bg-card">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled || isSending}
            className="min-h-[60px] resize-none"
          />
          <div className="flex flex-col gap-2">
            <Button
              size="icon"
              disabled={!message.trim() || isSending || disabled}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
