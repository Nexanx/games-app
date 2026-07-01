"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { SuggestedQuestions } from "@/components/chat/SuggestedQuestions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/services/api";
import type { ChatMessage } from "@/types";

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: -1,
      session_id: 0,
      role: "assistant",
      content: "Cześć. Mogę odpowiadać po polsku na pytania o gry, backlog, postacie PoE i zapisane dropy.",
      created_at: new Date().toISOString()
    }
  ]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) {
      return;
    }
    setInput("");
    const userMessage: ChatMessage = {
      id: -Date.now(),
      session_id: sessionId ?? 0,
      role: "user",
      content: question,
      created_at: new Date().toISOString()
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const response = await api.chat(question, sessionId);
      setSessionId(response.session_id);
      setMessages((current) => [...current, response.message]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: -Date.now() - 1,
          session_id: sessionId ?? 0,
          role: "assistant",
          content: err instanceof Error ? err.message : "Nie udało się wysłać pytania.",
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  return (
    <div className="space-y-4">
      <SuggestedQuestions onPick={send} />
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle>Chatbot</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[62vh] min-h-[420px] space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
          <form className="flex gap-2 border-t border-border p-3" onSubmit={submit}>
            <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Zapytaj o swoje dane..." />
            <Button type="submit" disabled={loading} title="Wyślij">
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Wyślij</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

