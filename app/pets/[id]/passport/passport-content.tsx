"use client";

import type { Vaccination, ParasiteLog } from "@/lib/types/pets";
import type { PetMilestone, PetWeightLog, HealthReminder } from "@/lib/types/health";
import { WeightChart } from "@/components/weight-chart";
import { MilestoneTimeline } from "@/components/milestone-timeline";

interface PassportContentProps {
  pet: {
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    date_of_birth: string | null;
    microchip_number: string | null;
    photo_url: string | null;
    gotcha_day: string | null;
    is_spayed_neutered: boolean | null;
  };
  vaccinations: Vaccination[];
  parasiteLogs: ParasiteLog[];
  weightLogs: PetWeightLog[];
  milestones: PetMilestone[];
  reminders: HealthReminder[];
}

export function PassportContent({
  pet,
  vaccinations,
  parasiteLogs,
  weightLogs,
  milestones,
  reminders,
}: PassportContentProps) {
  const age = pet.date_of_birth ? calculateAge(pet.date_of_birth) : null;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white shadow-lg">
        {pet.photo_url ? (
          <img
            src={pet.photo_url}
            alt={pet.name}
            className="h-20 w-20 rounded-full border-2 border-white object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-white/20 text-3xl">
            🐾
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{pet.name}</h1>
          <p className="text-sm text-white/80">
            {[pet.species, pet.breed].filter(Boolean).join(" · ")}
          </p>
          {age && <p className="text-sm text-white/80">{age}</p>}
          {pet.microchip_number && (
            <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs">
              📡 {pet.microchip_number}
            </span>
          )}
        </div>
      </div>

      {/* Vaccine Status */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">สถานะวัคซีน</h2>
        {vaccinations.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีข้อมูลวัคซีน</p>
        ) : (
          <div className="space-y-2">
            {vaccinations.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-sm font-medium">{v.name}</span>
                  {v.next_due_date && (
                    <p className="text-xs text-gray-500">นัดถัดไป: {v.next_due_date}</p>
                  )}
                </div>
                <VaccineStatusBadge status={v.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Parasite Prevention */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">ป้องกันพยาธิ</h2>
        {parasiteLogs.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-2">
            {parasiteLogs.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-sm font-medium">{p.medicine_name ?? "ยาถ่ายพยาธิ"}</span>
                  <p className="text-xs text-gray-500">ให้ยาวันที่: {p.administered_date}</p>
                </div>
                <span className="text-xs text-gray-400">ถัดไป: {p.next_due_date}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weight Chart */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">น้ำหนัก (กก.)</h2>
        <WeightChart data={weightLogs} />
      </section>

      {/* Milestone Timeline */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Milestone Timeline</h2>
        <MilestoneTimeline milestones={milestones} />
      </section>

      {/* Upcoming Reminders */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">แจ้งเตือนที่กำลังจะถึง</h2>
        {reminders.length === 0 ? (
          <p className="text-sm text-gray-400">ไม่มีแจ้งเตือน</p>
        ) : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 p-3"
              >
                <span className="text-sm font-medium text-indigo-900">{r.title}</span>
                <span className="text-xs text-indigo-600">{r.due_date}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VaccineStatusBadge({ status }: { status: "protected" | "due_soon" | "overdue" }) {
  const config = {
    protected: { label: "ป้องกันแล้ว", color: "bg-green-100 text-green-700" },
    due_soon: { label: "ใกล้ครบกำหนด", color: "bg-yellow-100 text-yellow-700" },
    overdue: { label: "เลยกำหนด", color: "bg-red-100 text-red-700" },
  };
  const { label, color } = config[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

function calculateAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const years = now.getFullYear() - dob.getFullYear();
  const months = now.getMonth() - dob.getMonth();

  if (years < 1) {
    const totalMonths = years * 12 + months;
    return `${Math.max(totalMonths, 0)} เดือน`;
  }
  return `${years} ขวบ`;
}
