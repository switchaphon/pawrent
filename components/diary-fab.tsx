"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";

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
  { icon: "🚿", label: "อาบน้ำตัดขน", key: "grooming" },
  { icon: "🏥", label: "พบหมอ", key: "vet_visit" },
];

interface DiaryFabProps {
  /** If a pet is selected in the chip filter, pre-fill target forms */
  selectedPetId?: string | null;
  onSelect: (key: string, petId?: string | null) => void;
}

export function DiaryFab({ selectedPetId, onSelect }: DiaryFabProps) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleItemClick = (key: string) => {
    setOpen(false);
    onSelect(key, selectedPetId);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* FAB container — bottom-right, above safe area */}
      <div className="fixed bottom-6 right-5 z-50 flex flex-col items-end gap-2.5">
        {/* Item picker — shown when open */}
        {open && (
          <div className="flex flex-col items-end gap-2 animate-fade-in">
            {FAB_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => handleItemClick(item.key)}
                className="flex items-center gap-2.5 rounded-full bg-surface border border-border shadow-[0_4px_20px_rgba(46,42,46,0.15)] pl-3.5 pr-4 py-2 active:scale-95 transition-transform"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] bg-gradient-to-br from-[#F06FA8] via-[#FF9285] to-[#FFCB6B] shadow-[0_2px_8px_rgba(255,146,133,0.25)] flex-shrink-0"
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span className="text-[13px] font-semibold text-text-main whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดเมนู" : "เพิ่มบันทึก"}
          aria-expanded={open}
          className={[
            "flex h-14 w-14 items-center justify-center rounded-full shadow-[0_4px_20px_rgba(255,130,99,0.4)] transition-all active:scale-95",
            open
              ? "bg-surface border-2 border-border text-text-muted"
              : "bg-gradient-to-br from-primary to-primary-light text-white",
          ].join(" ")}
        >
          {open ? <X size={22} /> : <Plus size={26} strokeWidth={2.5} />}
        </button>
      </div>
    </>
  );
}
