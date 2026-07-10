"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";

import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { SuggestedQuestions } from "@/components/chat/SuggestedQuestions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canSendChatMessage, getChatbotErrorMessage } from "@/lib/chatbot";
import { api } from "@/services/api";
import type { ChatMessage, ChatStatus } from "@/types";

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: -1,
      session_id: 0,
      role: "assistant",
      content: "Cześć. Mogę pomóc podsumować zapisane gry, listę Do ogrania i statystyki Path of Exile na podstawie danych dostępnych w aplikacji.",
      created_at: new Date().toISOString()
    }
  ]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    api
      .chatStatus()
      .then((status) => {
        setChatStatus(status);
        setError(status.configured ? null : status.message);
      })
      .catch(() => {
        setError("Nie udało się sprawdzić konfiguracji chatbota. Sprawdź, czy backend działa.");
        setChatStatus({ configured: false, missing: [], message: "Backend chatbota jest niedostępny." });
      })
      .finally(() => setStatusLoading(false));
  }, []);

  async function send(text: string) {
    const question = text.trim();
    if (!canSendChatMessage(question, chatStatus?.configured === true, loading || statusLoading)) {
      return;
    }
    setInput("");
    setError(null);
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
      const message = getChatbotErrorMessage(err);
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: -Date.now() - 1,
          session_id: sessionId ?? 0,
          role: "assistant",
          content: message,
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

  const configured = chatStatus?.configured === true;
  const sendingDisabled = !canSendChatMessage(input, configured, loading || statusLoading);
  const inputPlaceholder = statusLoading
    ? "Sprawdzam konfigurację chatbota..."
    : configured
      ? "Zapytaj o swoje dane..."
      : "Chatbot wymaga konfiguracji backendu";

  return (
    <div className="space-y-4">
      <SuggestedQuestions disabled={!configured || loading || statusLoading} onPick={send} />
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle>Chatbot</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[62vh] min-h-[420px] space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Czekam na odpowiedź...
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
          <form className="flex gap-2 border-t border-border p-3" onSubmit={submit}>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={inputPlaceholder}
              aria-label="Wiadomość do chatbota"
            />
            <Button type="submit" disabled={sendingDisabled} title="Wyślij">
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{loading ? "Czekaj" : "Wyślij"}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
