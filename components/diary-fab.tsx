"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";

interface FabTarget {
  icon: string;
  label: string;
  key: string;
}

const FAB_ITEMS: FabTarget[] = [
  { icon: "📸", label: "ไดอารี่", key: "diary_entries" },
  { icon: "💉", label: "วัคซีน", key: "vaccinations" },
  { icon: "💊", label: "ยาหยอด", key: "parasite_external" },
  { icon: "🪱", label: "ถ่ายพยาธิ", key: "parasite_internal" },
  { icon: "⚖️", label: "ชั่งน้ำหนัก", key: "pet_weight_logs" },
  { icon: "🚿", label: "อาบน้ำ", key: "grooming" },
  { icon: "🏥", label: "พบหมอ", key: "vet_visit" },
];

interface DiaryFabProps {
  /** If a pet is selected in the chip filter, pre-fill target forms */
  selectedPetId?: string | null;
  onSelect: (key: string, petId?: string | null) => void;
}

export function DiaryFab({ selectedPetId, onSelect }: DiaryFabProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  const handleItemClick = useCallback(
    (key: string) => {
      close();
      onSelect(key, selectedPetId);
    },
    [close, onSelect, selectedPetId]
  );

  return (
    <>
      {/* Action sheet overlay — slides up from bottom */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เพิ่มบันทึก"
          className="fixed inset-0 z-[200] flex items-end bg-black/40"
        >
          {/* Backdrop — separate element so clicks on it close the sheet */}
          <div
            data-testid="action-sheet-backdrop"
            className="absolute inset-0"
            aria-hidden
            onClick={close}
          />

          {/* Sheet — slides up, sits above backdrop */}
          <div
            className="relative w-full rounded-t-[24px] bg-surface px-5 pb-10 pt-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border" aria-hidden />

            {/* Title row */}
            <div className="mb-4 flex items-center justify-center">
              <span className="flex-1 text-center text-base font-bold text-text-heading">
                เพิ่มบันทึก
              </span>
              <button
                onClick={close}
                aria-label="ปิด"
                className="absolute right-5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-text-muted transition-transform active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* 3-column grid of action items */}
            <div className="grid grid-cols-3 gap-3">
              {FAB_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleItemClick(item.key)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface-alt px-2 py-4 transition-transform active:scale-95"
                >
                  <span className="text-[28px] leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="text-[12px] font-semibold text-text">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAB button — fixed bottom-right, always visible */}
      <button
        onClick={() => setOpen(true)}
        aria-label="เพิ่มบันทึก"
        aria-expanded={open}
        className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-white shadow-[0_4px_20px_rgba(255,130,99,0.4)] transition-transform active:scale-95"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </>
  );
}
