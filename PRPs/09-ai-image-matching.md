# PRP-09: AI Image Matching & Similarity Search

## Priority: MEDIUM

## Prerequisites: PRP-07 (matching engine to integrate with)

## Problem

Attribute-based matching (PRP-07) covers species, breed, color, and location — but text descriptions are subjective. One person's "golden brown" is another's "tan." A photo is undeniable evidence. By generating vector embeddings from pet photos and comparing them with cosine similarity, the platform can surface visually similar matches that text alone would miss — especially for mixed-breed animals where breed labels are unreliable.

This is the Phase II differentiator that moves Pawrent from "smart bulletin board" to "AI-powered recovery engine."

---

## Scope

**In scope:**

- Enable pgvector extension on Supabase
- Generate CLIP embeddings for pet photos at upload time
- Store embeddings in `pet_photo_embeddings` table
- Visual similarity search: compare found pet photo against lost pet database
- Integrate similarity score into PRP-07 matching engine as additional weighted factor
- AI breed/description auto-fill: analyze found pet photo to suggest species, breed, color, size
- Duplicate detection: flag likely duplicate found reports (same animal, multiple reporters)

**Out of scope:**

- Self-hosted embedding model (use API)
- Real-time video analysis
- Pet facial recognition (embeddings are visual similarity, not identity)

---

## Tasks

### 9.1 Enable pgvector

- [ ] Enable pgvector extension on Supabase

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 9.2 Embeddings Table

- [ ] Create `pet_photo_embeddings` table

```sql
CREATE TABLE IF NOT EXISTS pet_photo_embeddings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_url   text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('pet_profile', 'lost_alert', 'found_report')),
  source_id   uuid NOT NULL,  -- pet_id, alert_id, or found_report_id
  embedding   vector(512) NOT NULL,
  photo_hash  text,  -- SHA256 for dedup
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_embeddings_vector ON pet_photo_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE UNIQUE INDEX idx_embeddings_photo_hash ON pet_photo_embeddings(photo_hash)
  WHERE photo_hash IS NOT NULL;
```

### 9.3 Embedding Generation Service

- [ ] Create `lib/ai/embeddings.ts` — generate CLIP embeddings via API
- [ ] Rate limit: max 10 embeddings per minute per user
- [ ] Cache by photo hash (avoid re-computing for same image)

```typescript
// lib/ai/embeddings.ts
export async function generateEmbedding(imageUrl: string): Promise<number[]> {
  // Option A: OpenAI CLIP via API
  // Option B: Replicate hosted CLIP model
  // Option C: Self-hosted via Supabase Edge Function
  //
  // Returns: 512-dimensional float vector
}
```

### 9.4 Similarity Search RPC

- [ ] Create `find_similar_pets()` RPC function

```sql
CREATE OR REPLACE FUNCTION find_similar_pets(
  p_embedding vector(512),
  p_source_type text DEFAULT 'lost_alert',  -- search against this type
  p_limit int DEFAULT 10,
  p_min_similarity numeric DEFAULT 0.6
)
RETURNS TABLE (
  source_id uuid,
  photo_url text,
  similarity numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.source_id,
    e.photo_url,
    (1 - (e.embedding <=> p_embedding))::numeric AS similarity
  FROM pet_photo_embeddings e
  WHERE e.source_type = p_source_type
    AND (1 - (e.embedding <=> p_embedding)) >= p_min_similarity
  ORDER BY e.embedding <=> p_embedding ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 9.5 Integration with Matching Engine (PRP-07)

- [ ] Add `weight_image_similarity` to `match_config`
- [ ] Extend `cross_match_alert()` to include image similarity as scoring factor
- [ ] Image similarity score: 0-100 based on cosine distance

```sql
INSERT INTO match_config (key, value) VALUES
  ('weight_image_similarity', 0.20)
ON CONFLICT (key) DO NOTHING;

-- Adjust other weights to total 1.0 with image:
-- species: 0.20, breed: 0.15, color: 0.10, size: 0.05, proximity: 0.20, temporal: 0.10, image: 0.20
```

### 9.6 AI Photo Analysis (Auto-Fill for Found Reports)

- [ ] Create `lib/ai/pet-analyzer.ts` — Claude API call to describe pet from photo
- [ ] Returns: species, breed guess, color description, size estimate, distinguishing features
- [ ] Integrates into PRP-05 found report form as pre-filled suggestions

```typescript
// lib/ai/pet-analyzer.ts
export async function analyzePetPhoto(imageUrl: string): Promise<{
  species: "dog" | "cat" | "other";
  breed_guess: string;
  color_description: string;
  size_estimate: "tiny" | "small" | "medium" | "large" | "giant";
  distinguishing_features: string[];
}> {
  // Claude API with vision capability
  // System prompt: "Analyze this pet photo. Identify species, likely breed, colors, estimated size, and distinguishing features. For mixed breeds, respond with 'Mixed Breed' or closest guess."
}
```

### 9.7 Duplicate Detection

- [ ] On found report creation, check similarity against recent found reports
- [ ] If cosine similarity > 0.9 within 5km and 48 hours → flag as potential duplicate
- [ ] Alert reporter: "A similar pet was reported nearby. Is this the same animal?"

### 9.8 Embedding Pipeline

- [ ] Background job: generate embeddings for existing pet photos
- [ ] Hook into photo upload: generate embedding on new pet_photos INSERT
- [ ] Hook into found report: generate embedding on photo_urls

---

## PDPA Checklist

- [x] Embeddings are mathematical vectors, not reconstructable to photos — no additional PII
- [x] Photo analysis via Claude API: review data processing agreement (DPA)
- [x] Embeddings deleted when source photo is deleted (CASCADE)
- [x] No facial recognition of humans in pet photos

---

## Rollback Plan

1. Remove `weight_image_similarity` from `match_config`
2. Matching engine reverts to attribute-only scoring (PRP-07 baseline)
3. Drop `pet_photo_embeddings` table
4. pgvector extension can remain

---

## Verification

```bash
npm run test
npm run type-check
```

- [ ] Upload pet photo → embedding generated and stored
- [ ] Similar photos return high similarity score (>0.8 for same pet)
- [ ] Different species return low similarity (<0.3)
- [ ] Matching engine includes image similarity in score breakdown
- [ ] AI photo analysis returns reasonable breed/color for common Thai breeds
- [ ] Duplicate detection flags reports with same animal photo
- [ ] IVFFlat index used (check with EXPLAIN ANALYZE)

---

## Confidence Score: 6/10

**Risk areas:**
- CLIP model accuracy for Thai mixed breeds is unproven
- API cost per embedding (need pricing analysis before launch)
- pgvector IVFFlat index needs >1000 rows to be effective
- Claude API for photo analysis: latency may be 2-5 seconds (UX concern)
- Two black Labradors or two tabby cats will have high similarity regardless of identity

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — AI image matching with pgvector and CLIP embeddings |
