"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import { getParasitePreventionNames, getParasitePreventionInfo } from "@/data/parasite-prevention";
import { apiFetch } from "@/lib/api";
import { parasiteLogSchema } from "@/lib/validations";
import { X, Loader2, PillIcon, Calendar, Info, Plus, Minus } from "lucide-react";

interface AddParasiteLogFormProps {
  petId: string;
  petSpecies: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddParasiteLogForm({
  petId,
  petSpecies,
  onSuccess,
  onCancel,
}: AddParasiteLogFormProps) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [administeredDate, setAdministeredDate] = useState(new Date().toISOString().split("T")[0]);
  const [reminderMonths, setReminderMonths] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productNames = getParasitePreventionNames(petSpecies);
  const selectedProductInfo = selectedProduct ? getParasitePreventionInfo(selectedProduct) : null;

  // Calculate next due date based on administered date and reminder months
  const calculateNextDueDate = () => {
    if (!administeredDate) return "";
    const date = new Date(administeredDate);
    date.setMonth(date.getMonth() + reminderMonths);
    return date.toISOString().split("T")[0];
  };

  // Update reminder months when product changes (use product's default duration)
  const handleProductChange = (productName: string) => {
    setSelectedProduct(productName);
    const productInfo = getParasitePreventionInfo(productName);
    if (productInfo) {
      setReminderMonths(productInfo.durationMonths);
    }
  };

  const handleIncrement = () => {
    setReminderMonths((prev) => Math.min(prev + 1, 12));
  };

  const handleDecrement = () => {
    setReminderMonths((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProduct || !administeredDate) {
      setError("Please fill in all required fields");
      return;
    }

    const validationResult = parasiteLogSchema.safeParse({
      pet_id: petId,
      medicine_name: selectedProduct || null,
      administered_date: administeredDate,
      next_due_date: calculateNextDueDate(),
    });
    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      const nextDueDate = calculateNextDueDate();
      await apiFetch("/api/parasite-logs", {
        method: "POST",
        body: JSON.stringify({
          pet_id: petId,
          medicine_name: selectedProduct,
          administered_date: administeredDate,
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
    <Card className="rounded-2xl p-4 shadow-lg bg-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-text-main flex items-center gap-2">
          <PillIcon className="w-5 h-5 text-primary" />
          Add Parasite Prevention
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
        {/* Product Selection */}
        <div className="space-y-2">
          <Label htmlFor="product">Product</Label>
          <SearchableSelect
            value={selectedProduct}
            onChange={handleProductChange}
            options={productNames}
            placeholder="Search and select product..."
          />
          {selectedProductInfo && (
            <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-lg text-sm">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-text-muted">
                <span className="font-medium text-text-main">{selectedProductInfo.brand}</span> by{" "}
                {selectedProductInfo.manufacturer}
                <span className="mx-1">•</span>
                <span className="text-primary">{selectedProductInfo.description}</span>
              </div>
            </div>
          )}
        </div>

        {/* Administered Date */}
        <div className="space-y-2">
          <Label htmlFor="administeredDate" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date Administered
          </Label>
          <Input
            id="administeredDate"
            type="date"
            value={administeredDate}
            onChange={(e) => setAdministeredDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="h-12 rounded-xl"
          />
        </div>

        {/* Reminder Months Stepper */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">Next Reminder</Label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={reminderMonths <= 1}
              className="w-10 h-10 rounded-full border border-input flex items-center justify-center hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-text-main">{reminderMonths}</span>
              <span className="text-sm text-text-muted ml-2">
                month{reminderMonths !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={reminderMonths >= 12}
              className="w-10 h-10 rounded-full border border-input flex items-center justify-center hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {selectedProductInfo && (
            <p className="text-xs text-text-muted text-center">
              Recommended: {selectedProductInfo.durationMonths} month
              {selectedProductInfo.durationMonths !== 1 ? "s" : ""} for {selectedProductInfo.name}
            </p>
          )}
        </div>

        {/* Next Due Date Preview */}
        {administeredDate && (
          <div className="p-3 bg-surface-alt rounded-xl text-center">
            <p className="text-xs text-text-muted mb-1">Next dose due on</p>
            <p className="font-semibold text-text-main">
              {new Date(calculateNextDueDate()).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        )}

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
            disabled={saving || !selectedProduct || !administeredDate}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Log"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
