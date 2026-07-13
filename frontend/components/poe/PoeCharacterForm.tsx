"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardPaste, Plus } from "lucide-react";
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
import type { PoeBuildPreview, PoeLeague } from "@/types";

const optionalHttpUrl = z.string().trim().refine((value) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Podaj poprawny adres HTTP lub HTTPS");

const optionalPoeNinjaUrl = optionalHttpUrl.refine((value) => {
  if (!value) return true;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "poe.ninja" || hostname.endsWith(".poe.ninja") || hostname === "poe2.ninja";
  } catch {
    return false;
  }
}, "Podaj link z domeny poe.ninja");

const schema = z.object({
  name: z.string().trim().min(1, "Podaj nick postaci"),
  game_version: z.enum(["poe1", "poe2"]),
  character_class: z.string().optional(),
  ascendancy: z.string().optional(),
  level: z.coerce.number().min(1).max(100),
  league_id: z.string().optional(),
  poe_ninja_url: optionalPoeNinjaUrl.optional(),
  profile_url: optionalHttpUrl.optional(),
  build_name: z.string().optional(),
  main_skill: z.string().optional(),
  mode: z.string().optional(),
  status: z.string().min(1),
  playtime_minutes: z.coerce.number().min(0),
  notes: z.string().optional(),
  pob_code: z.string().max(2_000_000, "Kod PoB jest zbyt duży").optional()
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function PoeCharacterForm({ leagues, onAdded }: { leagues: PoeLeague[]; onAdded: () => void }) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<PoeBuildPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const { register, handleSubmit, reset, setValue, getValues, watch, formState } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      game_version: "poe1",
      level: 1,
      status: "ended",
      playtime_minutes: 0,
      pob_code: ""
    }
  });
  const selectedVersion = watch("game_version");
  const pobCode = watch("pob_code");
  const pobCodeField = register("pob_code");

  async function previewPob() {
    if (!pobCode?.trim()) {
      setMessage({ kind: "error", text: "Wklej kod PoB skopiowany z profilu postaci na poe.ninja." });
      return;
    }
    setPreviewing(true);
    setMessage(null);
    try {
      const imported = await api.previewPob(pobCode);
      setPreview(imported);
      setValue("game_version", imported.game_version);
      setValue("character_class", imported.character_class ?? "");
      setValue("ascendancy", imported.ascendancy ?? "");
      setValue("level", imported.level);
      const selectedLeague = leagues.find((league) => String(league.id) === getValues("league_id"));
      if (selectedLeague && selectedLeague.game_version !== imported.game_version) {
        setValue("league_id", "");
      }
      setMessage({
        kind: "success",
        text: `Odczytano ${imported.equipment_count} założonych przedmiotów. Uzupełnij nick i ligę, a następnie zapisz snapshot.`
      });
    } catch (err) {
      setPreview(null);
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Nie udało się odczytać kodu PoB" });
    } finally {
      setPreviewing(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setMessage(null);
    try {
      if (values.pob_code?.trim()) {
        await api.importPobCharacter({
          name: values.name,
          code: values.pob_code,
          league_id: values.league_id ? Number(values.league_id) : null,
          poe_ninja_url: values.poe_ninja_url || null,
          status: values.status,
          playtime_minutes: values.playtime_minutes,
          notes: values.notes || null
        });
      } else {
        await api.createCharacter({
          name: values.name,
          game_version: values.game_version,
          level: values.level,
          status: values.status,
          playtime_minutes: values.playtime_minutes,
          league_id: values.league_id ? Number(values.league_id) : null,
          character_class: values.character_class || null,
          ascendancy: values.ascendancy || null,
          poe_ninja_url: values.poe_ninja_url || null,
          profile_url: values.profile_url || null,
          build_name: values.build_name || null,
          main_skill: values.main_skill || null,
          mode: values.mode || null,
          notes: values.notes || null,
          snapshot_source: "manual"
        });
      }
      reset();
      setPreview(null);
      onAdded();
      setMessage({ kind: "success", text: "Końcowy snapshot postaci został zapisany." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Nie udało się dodać postaci" });
    }
  }

  const visibleLeagues = leagues.filter((league) => league.game_version === selectedVersion);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj końcowy snapshot postaci</CardTitle>
        <CardDescription>
          Na profilu postaci w poe.ninja wybierz „Copy PoB code”, wklej kod poniżej i zapisz stan z końca ligi. Aplikacja nie pobiera profilu ani drzewka.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Kod PoB z poe.ninja" htmlFor="poe-character-pob" error={formState.errors.pob_code?.message}>
            <Textarea
              id="poe-character-pob"
              className="min-h-32 font-mono text-xs"
              {...pobCodeField}
              placeholder="Wklej kod z przycisku Copy PoB code…"
              onChange={(event) => {
                pobCodeField.onChange(event);
                setPreview(null);
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={previewPob} disabled={previewing || !pobCode?.trim()}>
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              {previewing ? "Odczytywanie…" : "Odczytaj snapshot"}
            </Button>
            {preview ? (
              <p className="text-sm text-muted-foreground">
                Poziom {preview.level} · {preview.ascendancy || preview.character_class || "brak klasy"} · {preview.equipment_count} przedmiotów
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nick postaci" htmlFor="poe-character-name" error={formState.errors.name?.message}>
              <Input id="poe-character-name" {...register("name")} placeholder="Nazwa postaci w grze" />
            </Field>
            <Field label="Link źródłowy poe.ninja (opcjonalnie)" htmlFor="poe-character-ninja" error={formState.errors.poe_ninja_url?.message}>
              <Input id="poe-character-ninja" type="url" {...register("poe_ninja_url")} placeholder="https://poe.ninja/builds/..." />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Gra" htmlFor="poe-character-version">
              <Select id="poe-character-version" {...register("game_version")} disabled={Boolean(preview)}>
                <option value="poe1">Path of Exile 1</option>
                <option value="poe2">Path of Exile 2</option>
              </Select>
            </Field>
            <Field label="Liga" htmlFor="poe-character-league">
              <Select id="poe-character-league" {...register("league_id")}>
                <option value="">Bez ligi</option>
                {visibleLeagues.map((league) => (
                  <option key={league.id} value={league.id}>{league.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="poe-character-status">
              <Select id="poe-character-status" {...register("status")}>
                <option value="ended">Zakończona</option>
                <option value="rip">Rip</option>
                <option value="active">Aktywna</option>
                <option value="test">Testowa</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Klasa" htmlFor="poe-character-class">
              <Input id="poe-character-class" {...register("character_class")} readOnly={Boolean(preview)} placeholder="Witch, Mercenary…" />
            </Field>
            <Field label="Ascendancy" htmlFor="poe-character-ascendancy">
              <Input id="poe-character-ascendancy" {...register("ascendancy")} readOnly={Boolean(preview)} placeholder="Elementalist…" />
            </Field>
            <Field label="Poziom" htmlFor="poe-character-level" error={formState.errors.level?.message}>
              <Input id="poe-character-level" type="number" min={1} max={100} {...register("level")} readOnly={Boolean(preview)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Czas gry w minutach" htmlFor="poe-character-playtime" error={formState.errors.playtime_minutes?.message}>
              <Input id="poe-character-playtime" type="number" min={0} {...register("playtime_minutes")} />
            </Field>
            <Field label="Profil lub inny link (wpis ręczny)" htmlFor="poe-character-profile" error={formState.errors.profile_url?.message}>
              <Input id="poe-character-profile" type="url" {...register("profile_url")} placeholder="https://…" />
            </Field>
          </div>
          {!preview && !pobCode?.trim() ? (
            <details className="rounded-lg border border-border bg-muted/30 p-3">
              <summary className="cursor-pointer font-medium">Opcjonalne dane wpisu ręcznego</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Build" htmlFor="poe-character-build">
                  <Input id="poe-character-build" {...register("build_name")} placeholder="Nazwa buildu" />
                </Field>
                <Field label="Główna umiejętność" htmlFor="poe-character-skill">
                  <Input id="poe-character-skill" {...register("main_skill")} placeholder="Lightning Arrow…" />
                </Field>
                <Field label="Tryb" htmlFor="poe-character-mode">
                  <Input id="poe-character-mode" {...register("mode")} placeholder="trade, SSF, hardcore" />
                </Field>
              </div>
            </details>
          ) : null}
          <Field label="Notatki" htmlFor="poe-character-notes">
            <Textarea id="poe-character-notes" {...register("notes")} />
          </Field>
          {message ? (
            <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
              {message.text}
            </p>
          ) : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={formState.isSubmitting || previewing}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {formState.isSubmitting ? "Zapisywanie…" : "Zapisz snapshot"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
