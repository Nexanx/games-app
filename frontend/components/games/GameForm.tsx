"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import { splitList } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "Podaj tytuł"),
  cover_url: z.string().optional(),
  release_date: z.string().optional(),
  genres: z.string().optional(),
  platforms: z.string().optional(),
  external_url: z.string().optional(),
  description: z.string().optional(),
  preferred_platform: z.string().optional(),
  note: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export function GameForm({ onAdded }: { onAdded: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", genres: "", platforms: "", description: "" }
  });

  async function onSubmit(values: FormValues) {
    setMessage(null);
    try {
      const game = await api.createGame({
        title: values.title,
        cover_url: values.cover_url || null,
        release_date: values.release_date || null,
        genres: splitList(values.genres),
        platforms: splitList(values.platforms),
        external_source: "manual",
        external_url: values.external_url || null,
        description: values.description || null
      });
      await api.createBacklog({
        game_id: game.id,
        position: 0,
        preferred_platform: values.preferred_platform || splitList(values.platforms)[0] || null,
        note: values.note || null
      });
      reset();
      setMessage(`Dodano ręcznie: ${game.title}`);
      onAdded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się dodać gry");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj ręcznie</CardTitle>
        <CardDescription>Wpisz tytuł, a backend spróbuje pobrać okładkę i metadane z RAWG.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Tytuł" error={formState.errors.title?.message}>
            <Input {...register("title")} placeholder="Tytuł gry" />
          </Field>
          <Field label="URL okładki (opcjonalnie)">
            <Input {...register("cover_url")} placeholder="https://..." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data premiery">
              <Input type="date" {...register("release_date")} />
            </Field>
            <Field label="Link zewnętrzny">
              <Input {...register("external_url")} placeholder="https://..." />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gatunki">
              <Input {...register("genres")} placeholder="RPG, Action" />
            </Field>
            <Field label="Platformy">
              <Input {...register("platforms")} placeholder="PC, PS5" />
            </Field>
          </div>
          <Field label="Opis">
            <Textarea {...register("description")} placeholder="Krótki opis lub notatka" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferowana platforma">
              <Input {...register("preferred_platform")} placeholder="PC" />
            </Field>
            <Field label="Notatka na liście">
              <Input {...register("note")} placeholder="Dlaczego chcę zagrać?" />
            </Field>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Dodaj do listy Do ogrania
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
