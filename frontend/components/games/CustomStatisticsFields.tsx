"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CustomStatistic, StatisticValueType } from "@/types";

export function CustomStatisticsFields({
  statistics,
  onChange
}: {
  statistics: CustomStatistic[];
  onChange: (statistics: CustomStatistic[]) => void;
}) {
  function update(index: number, patch: Partial<CustomStatistic>) {
    onChange(statistics.map((statistic, itemIndex) => itemIndex === index ? { ...statistic, ...patch } : statistic));
  }

  return (
    <section className="space-y-3" aria-labelledby="custom-statistics-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="custom-statistics-heading" className="font-semibold">Własne statystyki</h2>
          <p className="text-sm text-muted-foreground">Dodaj dowolne pola tekstowe, liczbowe lub tak/nie.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...statistics, { name: "", value: "", value_type: "text" }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Dodaj statystykę
        </Button>
      </div>
      {statistics.map((statistic, index) => (
        <div key={statistic.id ?? index} className="grid gap-3 rounded-lg border border-border bg-background/45 p-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`stat-name-${index}`}>Nazwa statystyki</Label>
            <Input
              id={`stat-name-${index}`}
              value={statistic.name}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="np. Liczba śmierci"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`stat-type-${index}`}>Typ</Label>
            <Select
              id={`stat-type-${index}`}
              value={statistic.value_type}
              onChange={(event) => {
                const valueType = event.target.value as StatisticValueType;
                update(index, { value_type: valueType, value: valueType === "boolean" ? "true" : "" });
              }}
            >
              <option value="text">Tekst</option>
              <option value="number">Liczba</option>
              <option value="boolean">Tak / nie</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`stat-value-${index}`}>Wartość</Label>
            {statistic.value_type === "boolean" ? (
              <Select id={`stat-value-${index}`} value={statistic.value} onChange={(event) => update(index, { value: event.target.value })}>
                <option value="true">Tak</option>
                <option value="false">Nie</option>
              </Select>
            ) : (
              <Input
                id={`stat-value-${index}`}
                type={statistic.value_type === "number" ? "number" : "text"}
                step={statistic.value_type === "number" ? "any" : undefined}
                value={statistic.value}
                onChange={(event) => update(index, { value: event.target.value })}
                placeholder="Wartość"
              />
            )}
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={() => onChange(statistics.filter((_, itemIndex) => itemIndex !== index))}
            aria-label={`Usuń statystykę ${statistic.name || index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </section>
  );
}
