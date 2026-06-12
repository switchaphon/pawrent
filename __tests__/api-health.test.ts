/**
 * Unit tests for app/api/health/route.ts
 *
 * Container healthchecks (Docker HEALTHCHECK, compose, k8s probes) poll this
 * route; it must stay dependency-free and always return 200.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("should return 200", () => {
    const response = GET();
    expect(response.status).toBe(200);
  });

  it("should return { status: 'ok' }", async () => {
    const response = GET();
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
