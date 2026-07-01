import { ChatWindow } from "@/components/chat/ChatWindow";

export default function ChatbotPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Asystent danych</p>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Chatbot</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Intent-based chatbot działa lokalnie w backendzie i odpowiada wyłącznie na podstawie zapisanych danych.
        </p>
      </header>
      <ChatWindow />
    </div>
  );
}

