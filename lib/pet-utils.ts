import type { Pet } from "./types";

export function calculateAge(dob: string | null): string {
  if (!dob) return "Age unknown";
  const birthDate = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birthDate.getFullYear();
  const months = now.getMonth() - birthDate.getMonth();
  const adjustedMonths = months < 0 ? 12 + months : months;
  const adjustedYears = months < 0 ? years - 1 : years;
  if (adjustedYears === 0) return `${adjustedMonths} months`;
  if (adjustedMonths === 0) return `${adjustedYears} years`;
  return `${adjustedYears} years ${adjustedMonths} months`;
}

export function calculateDaysLeft(nextDueDate: string | null): number | undefined {
  if (!nextDueDate) return undefined;
  const due = new Date(nextDueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function sortByDOB(pets: Pet[]): Pet[] {
  return [...pets].sort((a, b) => {
    if (!a.date_of_birth) return 1;
    if (!b.date_of_birth) return -1;
    return new Date(a.date_of_birth).getTime() - new Date(b.date_of_birth).getTime();
  });
}
