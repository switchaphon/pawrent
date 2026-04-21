"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import { getVaccinesBySpecies, getVaccineInfo, type VaccineInfo } from "@/data/vaccines";
import { apiFetch } from "@/lib/api";
import { vaccinationSchema } from "@/lib/validations";
import { X, Loader2, Syringe, Calendar, Info } from "lucide-react";

interface AddVaccineFormProps {
  petId: string;
  petSpecies: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function calculateStatus(nextDueDate: string): "protected" | "due_soon" | "overdue" {
  const now = new Date();
  const due = new Date(nextDueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "due_soon";
  return "protected";
}

export function AddVaccineForm({ petId, petSpecies, onSuccess, onCancel }: AddVaccineFormProps) {
  const [selectedVaccine, setSelectedVaccine] = useState("");
  const [injectionDate, setInjectionDate] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vaccines = getVaccinesBySpecies(petSpecies);
  const vaccineNames = vaccines.map((v) => v.name);
  const selectedVaccineInfo = selectedVaccine ? getVaccineInfo(selectedVaccine, petSpecies) : null;

  // Auto-calculate next due date when injection date and vaccine are selected
  const handleInjectionDateChange = (date: string) => {
    setInjectionDate(date);
    if (date && selectedVaccineInfo) {
      const injDate = new Date(date);
      injDate.setMonth(injDate.getMonth() + selectedVaccineInfo.typicalDurationMonths);
      setNextDueDate(injDate.toISOString().split("T")[0]);
    }
  };

  const handleVaccineChange = (vaccineName: string) => {
    setSelectedVaccine(vaccineName);
    // Recalculate next due date if injection date is set
    if (injectionDate) {
      const vaccineInfo = getVaccineInfo(vaccineName, petSpecies);
      if (vaccineInfo) {
        const injDate = new Date(injectionDate);
        injDate.setMonth(injDate.getMonth() + vaccineInfo.typicalDurationMonths);
        setNextDueDate(injDate.toISOString().split("T")[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedVaccine || !injectionDate || !nextDueDate) {
      setError("Please fill in all fields");
      return;
    }

    const status = calculateStatus(nextDueDate);
    const validationResult = vaccinationSchema.safeParse({
      pet_id: petId,
      name: selectedVaccine,
      status,
      last_date: injectionDate,
      next_due_date: nextDueDate,
    });
    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/vaccinations", {
        method: "POST",
        body: JSON.stringify({
          pet_id: petId,
          name: selectedVaccine,
          status,
          last_date: injectionDate,
          next_due_date: nextDueDate,
        }),
      });

      onSuccess();
    } catch (err) {
      setError("An error occurred while saving");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl p-4 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-text-main flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" />
          Add Vaccination Record
        </h3>
        <button
          onClick={onCancel}
          aria-label="ปิด"
          className="p-1 rounded-full hover:bg-surface-alt transition-colors"
        >
          <X className="w-5 h-5 text-text-muted" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Vaccine Selection */}
        <div className="space-y-2">
          <Label htmlFor="vaccine">Vaccine</Label>
          <SearchableSelect
            value={selectedVaccine}
            onChange={handleVaccineChange}
            options={vaccineNames}
            placeholder="Search and select vaccine..."
          />
          {selectedVaccineInfo && (
            <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-lg text-sm">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-text-muted">
                <span className="font-medium text-text-main">{selectedVaccineInfo.brand}</span> by{" "}
                {selectedVaccineInfo.manufacturer}
                <span className="mx-1">•</span>
                <span
                  className={selectedVaccineInfo.category === "core" ? "text-success" : "text-info"}
                >
                  {selectedVaccineInfo.category === "core" ? "Core vaccine" : "Non-core vaccine"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Injection Date */}
        <div className="space-y-2">
          <Label htmlFor="injectionDate" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Injection Date
          </Label>
          <Input
            id="injectionDate"
            type="date"
            value={injectionDate}
            onChange={(e) => handleInjectionDateChange(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="h-12 rounded-xl"
          />
        </div>

        {/* Next Due Date */}
        <div className="space-y-2">
          <Label htmlFor="nextDueDate" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Next Due Date
          </Label>
          <Input
            id="nextDueDate"
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            min={injectionDate || undefined}
            className="h-12 rounded-xl"
          />
          {selectedVaccineInfo && injectionDate && (
            <p className="text-xs text-text-muted">
              Auto-calculated based on typical {selectedVaccineInfo.typicalDurationMonths}-month
              duration
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
            disabled={saving || !selectedVaccine || !injectionDate || !nextDueDate}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Vaccine"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
