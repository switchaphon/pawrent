/**
 * Tests for PassportContent client component (the rendered part of the passport page).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PassportContent } from "@/app/pets/[id]/passport/passport-content";

const basePet = {
  id: "p1",
  name: "Buddy",
  species: "dog",
  breed: "Golden Retriever",
  date_of_birth: "2023-04-14",
  microchip_number: "900123456789012",
  photo_url: "https://example.com/buddy.jpg",
  gotcha_day: null,
  is_spayed_neutered: false,
};

describe("PassportContent", () => {
  it("renders pet name and breed", () => {
    render(
      <PassportContent
        pet={basePet}
        vaccinations={[]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("dog · Golden Retriever")).toBeInTheDocument();
  });

  it("renders microchip number badge", () => {
    render(
      <PassportContent
        pet={basePet}
        vaccinations={[]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    expect(screen.getByText(/900123456789012/)).toBeInTheDocument();
  });

  it("renders vaccine status badges", () => {
    render(
      <PassportContent
        pet={basePet}
        vaccinations={[
          {
            id: "v1",
            pet_id: "p1",
            name: "Rabies",
            status: "protected",
            last_date: "2025-01-01",
            next_due_date: "2026-01-01",
            created_at: "2025-01-01",
          },
          {
            id: "v2",
            pet_id: "p1",
            name: "DHPP",
            status: "overdue",
            last_date: "2024-01-01",
            next_due_date: "2025-01-01",
            created_at: "2024-01-01",
          },
        ]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    expect(screen.getByText("Rabies")).toBeInTheDocument();
    expect(screen.getByText("ป้องกันแล้ว")).toBeInTheDocument();
    expect(screen.getByText("เลยกำหนด")).toBeInTheDocument();
  });

  it("renders empty states when no data", () => {
    render(
      <PassportContent
        pet={{ ...basePet, microchip_number: null }}
        vaccinations={[]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    expect(screen.getByText("ยังไม่มีข้อมูลวัคซีน")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีข้อมูล")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีข้อมูลน้ำหนัก")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มี Milestone")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีแจ้งเตือน")).toBeInTheDocument();
  });

  it("renders upcoming reminders", () => {
    render(
      <PassportContent
        pet={basePet}
        vaccinations={[]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[
          {
            id: "r1",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Rabies vaccine due",
            due_date: "2026-05-01",
            remind_days_before: 3,
            is_sent: false,
            sent_at: null,
            is_dismissed: false,
            created_at: "2026-04-01",
          },
        ]}
      />
    );
    expect(screen.getByText("Rabies vaccine due")).toBeInTheDocument();
    expect(screen.getByText("2026-05-01")).toBeInTheDocument();
  });

  it("renders parasite logs", () => {
    render(
      <PassportContent
        pet={basePet}
        vaccinations={[]}
        parasiteLogs={[
          {
            id: "pl1",
            pet_id: "p1",
            medicine_name: "Frontline Plus",
            administered_date: "2026-03-01",
            next_due_date: "2026-04-01",
            created_at: "2026-03-01",
          },
        ]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    expect(screen.getByText("Frontline Plus")).toBeInTheDocument();
  });

  it("renders pet photo when provided", () => {
    render(
      <PassportContent
        pet={basePet}
        vaccinations={[]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    const img = screen.getByAltText("Buddy");
    expect(img).toHaveAttribute("src", "https://example.com/buddy.jpg");
  });

  it("renders placeholder when no photo", () => {
    render(
      <PassportContent
        pet={{ ...basePet, photo_url: null }}
        vaccinations={[]}
        parasiteLogs={[]}
        weightLogs={[]}
        milestones={[]}
        reminders={[]}
      />
    );
    expect(screen.queryByAltText("Buddy")).not.toBeInTheDocument();
  });
});
