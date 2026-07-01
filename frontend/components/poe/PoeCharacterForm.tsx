"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import type { PoeLeague } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Podaj nazwę postaci"),
  game_version: z.enum(["poe1", "poe2"]),
  character_class: z.string().optional(),
  ascendancy: z.string().optional(),
  level: z.coerce.number().min(1).max(100),
  league_id: z.string().optional(),
  poe_ninja_url: z.string().optional(),
  profile_url: z.string().optional(),
  build_name: z.string().optional(),
  main_skill: z.string().optional(),
  mode: z.string().optional(),
  status: z.string().min(1),
  playtime_minutes: z.coerce.number().min(0),
  notes: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export function PoeCharacterForm({
  leagues,
  onAdded,
  onLeaguesChanged
}: {
  leagues: PoeLeague[];
  onAdded: () => void;
  onLeaguesChanged?: () => Promise<PoeLeague[]>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      game_version: "poe1",
      level: 1,
      status: "active",
      playtime_minutes: 0
    }
  });
  const selectedVersion = watch("game_version");
  const ninjaUrl = watch("poe_ninja_url");

  async function importNinja() {
    if (!ninjaUrl?.trim()) {
      return;
    }
    setMessage(null);
    try {
      const imported = await api.importFromNinja(ninjaUrl);
      if (imported.name) setValue("name", imported.name);
      if (imported.game_version) setValue("game_version", imported.game_version);
      if (imported.character_class) setValue("character_class", imported.character_class);
      if (imported.ascendancy) setValue("ascendancy", imported.ascendancy);
      if (imported.level) setValue("level", imported.level);
      if (imported.build_name) setValue("build_name", imported.build_name);
      if (imported.main_skill) setValue("main_skill", imported.main_skill);
      if (imported.profile_url) setValue("profile_url", imported.profile_url);
      if (imported.league_id) {
        await onLeaguesChanged?.();
        setValue("league_id", String(imported.league_id));
      }
      setValue("notes", imported.notes);
      setMessage(imported.notes ?? "Import przygotował dane do ręcznej weryfikacji.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się użyć linku poe.ninja");
    }
  }

  async function onSubmit(values: FormValues) {
    setMessage(null);
    try {
      await api.createCharacter({
        ...values,
        league_id: values.league_id ? Number(values.league_id) : null,
        character_class: values.character_class || null,
        ascendancy: values.ascendancy || null,
        poe_ninja_url: values.poe_ninja_url || null,
        profile_url: values.profile_url || null,
        build_name: values.build_name || null,
        main_skill: values.main_skill || null,
        mode: values.mode || null,
        notes: values.notes || null
      });
      reset();
      onAdded();
      setMessage("Postać dodana.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się dodać postaci");
    }
  }

  const visibleLeagues = leagues.filter((league) => league.game_version === selectedVersion);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj postać</CardTitle>
        <CardDescription>Import z poe.ninja może automatycznie utworzyć brakującą ligę z linku.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Link poe.ninja">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input {...register("poe_ninja_url")} placeholder="https://poe.ninja/..." />
              <Button type="button" variant="secondary" onClick={importNinja}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Import
              </Button>
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nazwa" error={formState.errors.name?.message}>
              <Input {...register("name")} placeholder="Nazwa postaci" />
            </Field>
            <Field label="Gra">
              <Select {...register("game_version")}>
                <option value="poe1">Path of Exile 1</option>
                <option value="poe2">Path of Exile 2</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Klasa">
              <Input {...register("character_class")} placeholder="Witch, Mercenary..." />
            </Field>
            <Field label="Ascendancy">
              <Input {...register("ascendancy")} placeholder="Elementalist..." />
            </Field>
            <Field label="Level">
              <Input type="number" min={1} max={100} {...register("level")} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Liga">
              <Select {...register("league_id")}>
                <option value="">Bez ligi</option>
                {visibleLeagues.map((league) => (
                  <option key={league.id} value={league.id}>{league.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select {...register("status")}>
                <option value="active">Aktywna</option>
                <option value="ended">Zakończona</option>
                <option value="rip">Rip</option>
                <option value="test">Testowa</option>
                <option value="deleted">Usunięta</option>
              </Select>
            </Field>
            <Field label="Czas w minutach">
              <Input type="number" min={0} {...register("playtime_minutes")} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Build">
              <Input {...register("build_name")} placeholder="Nazwa buildu" />
            </Field>
            <Field label="Główna umiejętność">
              <Input {...register("main_skill")} placeholder="Lightning Arrow..." />
            </Field>
            <Field label="Tryb">
              <Input {...register("mode")} placeholder="trade, SSF, hardcore" />
            </Field>
          </div>
          <Field label="Profil">
            <Input {...register("profile_url")} placeholder="https://..." />
          </Field>
          <Field label="Notatki">
            <Textarea {...register("notes")} />
          </Field>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Dodaj postać
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
