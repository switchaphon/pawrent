/**
 * Tests for WeightChart SVG component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeightChart } from "@/components/weight-chart";
import type { PetWeightLog } from "@/lib/types/health";

function makeLog(weight: number, date: string, id = `w-${Math.random()}`): PetWeightLog {
  return {
    id,
    pet_id: "p1",
    weight_kg: weight,
    measured_at: date,
    note: null,
    created_at: date,
  };
}

describe("WeightChart", () => {
  it("shows empty state when no data", () => {
    render(<WeightChart data={[]} />);
    expect(screen.getByText("ยังไม่มีข้อมูลน้ำหนัก")).toBeInTheDocument();
  });

  it("renders SVG with correct aria-label", () => {
    const data = [makeLog(5.0, "2026-01-01")];
    render(<WeightChart data={data} />);
    expect(screen.getByRole("img", { name: "Weight trend chart" })).toBeInTheDocument();
  });

  it("renders correct number of data points", () => {
    const data = [
      makeLog(4.5, "2026-01-01", "w1"),
      makeLog(5.0, "2026-02-01", "w2"),
      makeLog(5.3, "2026-03-01", "w3"),
    ];
    const { container } = render(<WeightChart data={data} />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(3);
  });

  it("renders polyline for multiple data points", () => {
    const data = [makeLog(4.5, "2026-01-01", "w1"), makeLog(5.0, "2026-02-01", "w2")];
    const { container } = render(<WeightChart data={data} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
  });

  it("does not render polyline for single data point", () => {
    const data = [makeLog(5.0, "2026-01-01")];
    const { container } = render(<WeightChart data={data} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeNull();
  });

  it("sorts data chronologically regardless of input order", () => {
    const data = [
      makeLog(5.5, "2026-03-01", "w3"),
      makeLog(4.0, "2026-01-01", "w1"),
      makeLog(5.0, "2026-02-01", "w2"),
    ];
    const { container } = render(<WeightChart data={data} />);
    const circles = container.querySelectorAll("circle");
    // First circle should have lowest x (leftmost = earliest date)
    const firstX = Number(circles[0].getAttribute("cx"));
    const lastX = Number(circles[2].getAttribute("cx"));
    expect(firstX).toBeLessThan(lastX);
  });

  it("accepts custom width and height", () => {
    const data = [makeLog(5.0, "2026-01-01")];
    const { container } = render(<WeightChart data={data} width={500} height={300} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 500 300");
  });
});
