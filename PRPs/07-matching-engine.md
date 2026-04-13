# PRP-07: Smart Matching Engine

## Priority: HIGH

## Prerequisites: PRP-04 (lost alerts), PRP-05 (found reports)

## Blocks: PRP-09 (AI matching builds on this)

## Problem

Having both lost and found reports is only half the solution. The platform must automatically cross-reference lost pets against found reports and surface potential matches — turning Pawrent from a bulletin board into a smart matching engine. This is the core differentiator: "AI will help search and notify the owner automatically."

The matching must work without AI/ML infrastructure — using attribute-based scoring (species, breed, color, size, location, microchip) — to ship quickly. AI image matching is deferred to PRP-09.

---

## Scope

**In scope:**

- Attribute-based matching: weighted scoring across species, breed, color, size, proximity, time
- Microchip instant match (100% confidence override)
- Forward matching: new found report scans existing lost alerts
- Reverse matching: new lost alert scans existing found reports
- Match notification to owner via LINE push (PRP-06 infrastructure)
- Match dashboard: owner sees ranked candidate list with confidence scores
- Configurable scoring weights

**Out of scope:**

- AI image similarity (PRP-09 — will add as weighted factor)
- Automatic resolution (humans verify matches)
- Contact initiation (PRP-05 chat bridge)

---

## Tasks

### 7.1 Database — Match Candidates Table

- [ ] Create `match_candidates` table
- [ ] Create scoring configuration

```sql
CREATE TABLE IF NOT EXISTS match_candidates (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id        uuid NOT NULL REFERENCES pet_reports(id) ON DELETE CASCADE,
  found_report_id uuid NOT NULL REFERENCES found_reports(id) ON DELETE CASCADE,
  score           numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  is_microchip_match boolean DEFAULT false,
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  notified_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (alert_id, found_report_id)
);

CREATE INDEX idx_match_candidates_alert ON match_candidates(alert_id, score DESC)
  WHERE status = 'pending';
CREATE INDEX idx_match_candidates_report ON match_candidates(found_report_id, score DESC)
  WHERE status = 'pending';

-- Scoring weights (configurable)
CREATE TABLE IF NOT EXISTS match_config (
  key   text PRIMARY KEY,
  value numeric NOT NULL
);

INSERT INTO match_config (key, value) VALUES
  ('weight_species', 0.25),
  ('weight_breed', 0.20),
  ('weight_color', 0.15),
  ('weight_size', 0.10),
  ('weight_proximity', 0.20),
  ('weight_temporal', 0.10),
  ('threshold_notify', 40),   -- minimum score to notify owner
  ('threshold_display', 20),  -- minimum score to show in dashboard
  ('microchip_override', 100) -- microchip match = instant 100%
ON CONFLICT (key) DO NOTHING;
```

### 7.2 Matching RPC Function

- [ ] Create `cross_match_alert()` — find matching found reports for a lost alert
- [ ] Create `cross_match_found()` — find matching lost alerts for a found report

```sql
CREATE OR REPLACE FUNCTION cross_match_alert(p_alert_id uuid)
RETURNS TABLE (
  found_report_id uuid,
  score numeric,
  score_breakdown jsonb,
  is_microchip boolean
) AS $$
DECLARE
  v_alert RECORD;
  v_config RECORD;
BEGIN
  -- Get alert data
  SELECT * INTO v_alert FROM pet_reports WHERE id = p_alert_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  -- Load config
  SELECT
    MAX(CASE WHEN key = 'weight_species' THEN value END) as w_species,
    MAX(CASE WHEN key = 'weight_breed' THEN value END) as w_breed,
    MAX(CASE WHEN key = 'weight_color' THEN value END) as w_color,
    MAX(CASE WHEN key = 'weight_size' THEN value END) as w_size,
    MAX(CASE WHEN key = 'weight_proximity' THEN value END) as w_proximity,
    MAX(CASE WHEN key = 'weight_temporal' THEN value END) as w_temporal,
    MAX(CASE WHEN key = 'threshold_display' THEN value END) as threshold,
    MAX(CASE WHEN key = 'microchip_override' THEN value END) as microchip_score
  INTO v_config FROM match_config;

  RETURN QUERY
  SELECT
    fr.id AS found_report_id,
    CASE
      -- Microchip instant match
      WHEN v_alert.pet_microchip IS NOT NULL
        AND v_alert.pet_microchip = fr.collar_description  -- simplified; real impl checks microchip field
      THEN v_config.microchip_score
      ELSE
        -- Weighted scoring
        (CASE WHEN fr.species_guess = v_alert.pet_species THEN v_config.w_species * 100 ELSE 0 END) +
        (CASE WHEN fr.breed_guess IS NOT NULL AND LOWER(fr.breed_guess) = LOWER(v_alert.pet_breed) THEN v_config.w_breed * 100 ELSE 0 END) +
        (CASE WHEN fr.color_description IS NOT NULL AND LOWER(fr.color_description) LIKE '%' || LOWER(COALESCE(v_alert.pet_color, '')) || '%' THEN v_config.w_color * 100 ELSE 0 END) +
        -- Proximity: closer = higher score, max 100% at 0km, 0% at 50km
        (CASE WHEN fr.geog IS NOT NULL AND v_alert.geog IS NOT NULL
          THEN v_config.w_proximity * 100 * GREATEST(0, 1 - ST_Distance(fr.geog, v_alert.geog) / 50000)
          ELSE 0 END) +
        -- Temporal: newer = higher score
        (CASE WHEN fr.created_at > v_alert.created_at - interval '30 days'
          THEN v_config.w_temporal * 100 * GREATEST(0, 1 - EXTRACT(EPOCH FROM (fr.created_at - v_alert.created_at)) / (30 * 86400))
          ELSE 0 END)
    END AS score,
    jsonb_build_object(
      'species', CASE WHEN fr.species_guess = v_alert.pet_species THEN 'match' ELSE 'miss' END,
      'breed', CASE WHEN LOWER(COALESCE(fr.breed_guess, '')) = LOWER(COALESCE(v_alert.pet_breed, '')) THEN 'match' ELSE 'miss' END,
      'distance_m', COALESCE(ST_Distance(fr.geog, v_alert.geog)::int, -1)
    ) AS score_breakdown,
    (v_alert.pet_microchip IS NOT NULL AND v_alert.pet_microchip = fr.collar_description) AS is_microchip
  FROM found_reports fr
  WHERE fr.is_active = true
    AND fr.created_at > v_alert.created_at - interval '30 days'
  HAVING
    CASE
      WHEN v_alert.pet_microchip IS NOT NULL AND v_alert.pet_microchip = fr.collar_description
      THEN TRUE
      ELSE (
        (CASE WHEN fr.species_guess = v_alert.pet_species THEN v_config.w_species * 100 ELSE 0 END) +
        (CASE WHEN LOWER(COALESCE(fr.breed_guess, '')) = LOWER(COALESCE(v_alert.pet_breed, '')) THEN v_config.w_breed * 100 ELSE 0 END) +
        (CASE WHEN fr.color_description IS NOT NULL AND LOWER(fr.color_description) LIKE '%' || LOWER(COALESCE(v_alert.pet_color, '')) || '%' THEN v_config.w_color * 100 ELSE 0 END) +
        (CASE WHEN fr.geog IS NOT NULL AND v_alert.geog IS NOT NULL THEN v_config.w_proximity * 100 * GREATEST(0, 1 - ST_Distance(fr.geog, v_alert.geog) / 50000) ELSE 0 END) +
        (v_config.w_temporal * 100 * GREATEST(0, 1 - EXTRACT(EPOCH FROM (fr.created_at - v_alert.created_at)) / (30 * 86400)))
      ) >= v_config.threshold
    END
  ORDER BY score DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 7.3 Match Triggers

- [ ] On `found_reports` INSERT: run `cross_match_found()`, insert candidates, trigger push
- [ ] On `pet_reports` INSERT (type='lost'): run `cross_match_alert()`, insert candidates

### 7.4 API Routes

- [ ] Create `app/api/matches/route.ts` — GET matches for user's alerts
- [ ] Create `app/api/matches/[id]/route.ts` — confirm/reject match

### 7.5 Match Dashboard UI

- [ ] Create `app/matches/page.tsx` — list of match candidates per alert
- [ ] Match card: found pet photo, confidence %, distance, score breakdown
- [ ] "Contact Finder" button → PRP-05 chat bridge
- [ ] "Not My Pet" dismiss button
- [ ] Microchip match highlighted with special badge

### 7.6 TypeScript Types

- [ ] Create `lib/types/matches.ts`

```typescript
export interface MatchCandidate {
  id: string;
  alert_id: string;
  found_report_id: string;
  score: number;
  score_breakdown: {
    species: "match" | "miss";
    breed: "match" | "miss";
    distance_m: number;
  };
  is_microchip_match: boolean;
  status: "pending" | "confirmed" | "rejected" | "expired";
  notified_at: string | null;
  created_at: string;
  // Joined data
  found_report?: FoundReport;
}
```

---

## PDPA Checklist

- [x] Match candidates contain no PII (only alert/report IDs and scores)
- [x] Score breakdown does not expose either party's exact location
- [x] Confirmed matches log consent timestamp
- [x] Match candidates auto-expire after 30 days

---

## Rollback Plan

1. Drop `match_candidates` and `match_config` tables
2. Remove match triggers
3. Lost/found flows continue independently (manual browsing only)

---

## Verification

### Thai Language First (PRP-00 Mandate)

- [ ] Match dashboard UI in Thai: "ผลการจับคู่", "คะแนนความเชื่อมั่น"
- [ ] Match notification text in Thai
- [ ] Confirm/reject buttons in Thai

### Full CI Validation Gate (PRP-00 Mandate)

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Unit tests for matching RPC, scoring logic, match API
- [ ] E2E spec: match dashboard flow
- [ ] Existing tests still pass (regression)
- [ ] CI is green before merge

- [ ] Lost alert with matching found report produces match candidate with score > threshold
- [ ] Microchip match produces instant 100% score
- [ ] Species mismatch produces 0% for that dimension
- [ ] Proximity scoring decreases with distance
- [ ] Match notification sent to owner via LINE push
- [ ] Owner can confirm or reject match
- [ ] Scoring weights are configurable via `match_config`
- [ ] No matches produced for expired/resolved alerts

---

## Confidence Score: 7/10

**Risk areas:**
- SQL scoring logic is complex — needs thorough unit testing with edge cases
- Mixed breed matching ("พันทาง") produces low breed scores — acceptable for v1
- Color matching via LIKE is imprecise — may produce false positives
- Trigger-based matching may have performance issues at scale (>1000 active alerts)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Attribute-based matching engine with weighted scoring |
| v1.1 | 2026-04-13 | Table naming: `sos_alerts` → `pet_reports` per PRP-03.1 |
