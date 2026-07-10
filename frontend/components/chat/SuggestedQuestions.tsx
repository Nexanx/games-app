"use client";

import { Button } from "@/components/ui/button";

export const suggestedQuestions = [
  "Ile gier ukończyłem?",
  "Ile gier mam do ogrania?",
  "Która gra zajęła mi najwięcej czasu?",
  "Pokaż moje najlepiej ocenione gry.",
  "Pokaż postacie z PoE 2.",
  "Ile Divine Orbów zdobyłem w ostatniej lidze?",
  "Podsumuj moje statystyki Path of Exile.",
  "Porównaj moje statystyki PoE 1 i PoE 2."
];

export function SuggestedQuestions({ disabled = false, onPick }: { disabled?: boolean; onPick: (question: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {suggestedQuestions.map((question) => (
        <Button key={question} variant="secondary" className="shrink-0" onClick={() => onPick(question)} disabled={disabled}>
          {question}
        </Button>
      ))}
    </div>
  );
}
