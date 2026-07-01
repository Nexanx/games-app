import { Bot, User } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[86%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[72%]",
          isUser ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
        )}
      >
        {message.content}
      </div>
      {isUser ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <User className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}

