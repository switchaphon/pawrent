# PRP-26: Pet Budget Tracker

## Priority: LOW

## Prerequisites: PRP-14 (design system), PRP-15 (services directory — for expense linking)

## Problem

Owning a pet as a family member is expensive — vet bills, food, grooming, accessories, boarding, insurance. In Thailand, a Golden Retriever can cost ฿50,000–฿100,000+ per year. Pet owners often can't see the full picture and struggle to justify costs to skeptical family members. A budget tracker that says "You've spent ฿45,000 on Mochi this year" creates transparency, builds financial awareness, and — importantly — strengthens emotional investment in the pet ("we've invested so much in Mochi").

This feature also gives Pawrent data on spending patterns that can inform premium tier pricing and B2B clinic partnership ROI messaging.

---

## Scope

**In scope:**

- Manual expense logging per pet
- Expense categories (vet, food, grooming, accessories, boarding, insurance, other)
- Monthly and annual spending summary
- Per-pet and total household spending view
- Spending chart (monthly trend, category breakdown)
- Export to CSV for personal records
- Link expenses to appointment records (PRP-17) or services directory entries (PRP-15)
- Recurring expense tracking (monthly food, insurance premium)

**Out of scope:**

- Bank/payment integration (privacy concern, complexity)
- Insurance claim automation (future premium feature)
- Multi-user household cost sharing (future feature)
- Tax deduction tracking (not applicable in Thailand currently)

---

## Tasks

### 26.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id         uuid REFERENCES pets(id) ON DELETE SET NULL, -- null = household (shared)
  category       text NOT NULL,        -- see ExpenseCategory
  amount         int NOT NULL,         -- THB satang (integer avoids float issues)
  description    text CHECK (char_length(description) <= 300),
  expense_date   date NOT NULL,
  service_id     uuid REFERENCES services(id) ON DELETE SET NULL,     -- optional link
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL, -- optional link
  receipt_url    text,                 -- photo of receipt in Supabase storage
  is_recurring   boolean DEFAULT false,
  recurrence_rule text,               -- e.g. "FREQ=MONTHLY" for monthly food subscription
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_expenses_user ON expenses(user_id, expense_date DESC);
CREATE INDEX idx_expenses_pet ON expenses(pet_id, expense_date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON expenses FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**Amount stored as integer (satang = THB × 100):**

- ฿500.00 → stored as `50000`
- Avoids floating point rounding errors
- Display: divide by 100 with `toLocaleString`

**ExpenseCategory enum:**

```typescript
export type ExpenseCategory =
  | "vet" // ค่าสัตวแพทย์
  | "food" // อาหาร
  | "grooming" // อาบน้ำ ตัดขน
  | "accessories" // อุปกรณ์และของเล่น
  | "boarding" // ฝากเลี้ยง / โรงแรมสัตว์
  | "insurance" // ประกันภัย
  | "medication" // ยาและวิตามิน
  | "training" // ฝึกสอน
  | "transport" // ค่าเดินทาง
  | "other"; // อื่นๆ
```

---

### 26.2 TypeScript Types

```typescript
export interface Expense {
  id: string;
  user_id: string;
  pet_id: string | null;
  category: ExpenseCategory;
  amount: number; // in satang
  description: string | null;
  expense_date: string;
  service_id: string | null;
  appointment_id: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  // Joined
  pets?: { name: string; photo_url: string | null } | null;
  services?: { name: string } | null;
}

export interface ExpenseSummary {
  total_satang: number;
  by_category: Record<ExpenseCategory, number>; // satang per category
  by_month: Array<{ month: string; total_satang: number }>;
  by_pet: Array<{ pet_id: string; pet_name: string; total_satang: number }>;
}

// Helper
export function formatTHB(satang: number): string {
  return (satang / 100).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  });
}
```

---

### 26.3 API Routes

**`app/api/expenses/route.ts`:**

- `GET` — list expenses, filters: `?pet_id=x&year=2026&month=4&category=vet`
- `POST` — add expense (auth required, rate limit 30/min)
- `PUT` — update expense (auth, ownership check)
- `DELETE` — delete expense (auth, ownership check)

**`app/api/expenses/summary/route.ts`:**

- `GET` — spending summary: `?year=2026&pet_id=x` (optional pet filter)
- Returns `ExpenseSummary` — total, by category, by month, by pet

**`app/api/expenses/export/route.ts`:**

- `GET` — CSV export of all expenses for a date range
- Returns `text/csv` with: date, pet, category, amount, description, service name

**Zod validation:**

```typescript
export const expenseSchema = z.object({
  pet_id: z.string().uuid().nullable().optional(),
  category: z.enum([
    "vet",
    "food",
    "grooming",
    "accessories",
    "boarding",
    "insurance",
    "medication",
    "training",
    "transport",
    "other",
  ]),
  amount: z.number().int().positive().max(10_000_000), // max ฿100,000 per entry
  description: z.string().max(300).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().max(100).nullable().optional(),
});
```

---

### 26.4 UI — Budget Tracker (`app/budget/page.tsx`)

**Navigation:** Accessed from pet profile card → "ค่าใช้จ่าย" button, or from Profile → Budget.

**Page layout:**

#### Summary Header

```
┌─────────────────────────────────────────────┐
│  💰 ค่าใช้จ่ายปี 2026        [2025] [2026] │
│                                              │
│  ยอดรวมทั้งหมด                              │
│  ฿45,320                                    │
│                                              │
│  [ Mochi ฿38,100 ] [ Luna ฿7,220 ]          │
└─────────────────────────────────────────────┘
```

#### Category Donut Chart

- Visual breakdown by category (ShadCN Recharts or CSS-only for LIFF compatibility)
- Tap category → filter expense list to that category

#### Monthly Trend Bar Chart

- 12-month bar chart showing spending per month
- Current month highlighted

#### Expense List

- Grouped by month: "เมษายน 2026", "มีนาคม 2026"
- Expense row: category icon, description, pet name, amount (right-aligned), date
- Tap row → edit/delete sheet
- Recurring expenses show 🔄 icon

#### Add Expense FAB (floating action button)

**Add expense sheet:**

- Pet selector (or "ค่าใช้จ่ายรวม" for household)
- Category picker (grid of icons + Thai labels)
- Amount input (Thai number keyboard)
- Date picker (defaults to today)
- Description (optional)
- Link to appointment: "เลือกนัดหมาย" (from appointments list)
- Receipt photo: optional upload
- Recurring toggle: frequency selector

---

### 26.5 Appointment Integration (PRP-17 link)

When viewing an appointment (PRP-17), add:

- "เพิ่มค่าใช้จ่าย" button → pre-fills appointment date, pet, category (based on appointment_type)
- If expense exists for this appointment_id: show expense amount on appointment card

---

### 26.6 Insight Cards (Home Dashboard — PRP-16 integration)

Add optional "Budget Insights" section to home dashboard:

```
┌─────────────────────────────────────────────┐
│ 💰 ค่าใช้จ่ายเดือนนี้                      │
│ ฿3,200 (เดือนที่แล้ว ฿2,800)               │
│ [ดูรายละเอียด]                              │
└─────────────────────────────────────────────┘
```

Hidden if no expenses logged. Optional — user can dismiss from settings.

---

## Task Ordering

**26.1 (DB) → 26.2 (Types + helpers) → 26.3 (API) → 26.4 (UI) → 26.5 (Appointment link) → 26.6 (Dashboard)**

## Verification

```bash
# Add expense → appears in list, summary updates
# Category totals match sum of individual expenses
# CSV export contains all expenses in date range
# Recurring expense shows on correct future months
# Appointment link pre-fills expense form correctly
# Amount stored in satang, displayed correctly in THB
# Summary by pet correct for multi-pet households
npx tsc --noEmit && npm test
```

## Confidence Score: 9/10

**Risk areas:**

- Satang integer storage: ensure all input/display conversions are consistent (×100 on input, ÷100 on display)
- Chart library: Recharts works in LIFF browser — test on real device; fallback to CSS bars if needed
- CSV export in LIFF: `window.location` download may not work in Line browser — use a `<a href>` link to the API endpoint instead
