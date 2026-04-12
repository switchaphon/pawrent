# PRP-08: Interactive Map View & Discovery

## Priority: MEDIUM

## Prerequisites: PRP-03 (PostGIS), PRP-04 (lost alerts), PRP-05 (found reports)

## Problem

Users need a visual way to discover lost and found pets in their area. The current map is limited to hospitals. A full-page interactive map with lost (red) and found (blue) markers, radius filtering, and pet photo avatars as pins — like Foundy's best UX feature — transforms passive browsing into spatial discovery. The "I'm here, what's nearby?" experience is critical for both pet owners checking their area and Good Samaritans wanting to help.

---

## Scope

**In scope:**

- Full-page map view showing lost alerts (red) and found reports (blue)
- Circular pet photo markers (Foundy-inspired emotional UX)
- Radius selector: 1km, 3km, 5km, 10km, 25km
- Marker clustering when zoomed out (Leaflet MarkerCluster)
- Tap marker → info card overlay (photo, breed, time, distance, reward)
- Bbox-based loading (query as map pans)
- Filter sidebar: species, date range, alert type, active/resolved
- "Watch this area" — save a zone for push alerts (PRP-06 integration)
- Heatmap toggle for density visualization

**Out of scope:**

- Real-time WebSocket marker updates (polling on map pan is sufficient)
- 3D terrain or satellite imagery
- Route planning / directions

---

## Tasks

### 8.1 Bbox Query RPC

- [ ] Create `alerts_within_bbox()` PostGIS RPC function

```sql
CREATE OR REPLACE FUNCTION alerts_within_bbox(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_type text DEFAULT 'all',  -- 'lost', 'found', 'all'
  p_species text DEFAULT 'all',
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  alert_type text,
  fuzzy_lat double precision,
  fuzzy_lng double precision,
  pet_name text,
  pet_species text,
  pet_breed text,
  pet_photo_url text,
  reward_amount int,
  created_at timestamptz
) AS $$
BEGIN
  -- Lost alerts
  IF p_type IN ('lost', 'all') THEN
    RETURN QUERY
    SELECT a.id, 'lost'::text,
      ROUND(ST_Y(a.geog::geometry) / 0.00225) * 0.00225,
      ROUND(ST_X(a.geog::geometry) / 0.00225) * 0.00225,
      a.pet_name, a.pet_species, a.pet_breed, a.pet_photo_url,
      a.reward_amount, a.created_at
    FROM sos_alerts a
    WHERE a.is_active = true
      AND a.alert_type = 'lost'
      AND (p_species = 'all' OR a.pet_species = p_species)
      AND a.geog && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography;
  END IF;

  -- Found reports
  IF p_type IN ('found', 'all') THEN
    RETURN QUERY
    SELECT fr.id, 'found'::text,
      ROUND(ST_Y(fr.geog::geometry) / 0.00225) * 0.00225,
      ROUND(ST_X(fr.geog::geometry) / 0.00225) * 0.00225,
      NULL::text, fr.species_guess, fr.breed_guess,
      fr.photo_urls[1],
      0, fr.created_at
    FROM found_reports fr
    WHERE fr.is_active = true
      AND (p_species = 'all' OR fr.species_guess = p_species)
      AND fr.geog && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.2 API Route

- [ ] Create `app/api/map/alerts/route.ts` — GET with bbox params
- [ ] Debounce protection: cache bbox results for 5 seconds

### 8.3 Map Component

- [ ] Create `components/discovery-map.tsx` — extends Leaflet patterns from `hospital-map.tsx`
- [ ] Circular pet photo markers using Leaflet `DivIcon` with CSS
- [ ] Red border = lost, Blue border = found
- [ ] MarkerCluster for density management
- [ ] User location dot (blue pulsing)

```bash
npm install leaflet.markercluster
```

### 8.4 Map Page

- [ ] Create `app/map/page.tsx` — full-page map view
- [ ] Radius selector overlay (pills: 1km, 3km, 5km, 10km, 25km)
- [ ] Filter toggle: All / Lost / Found
- [ ] Species filter tabs: All / Dogs / Cats
- [ ] Marker tap → bottom sheet with alert summary
- [ ] "View Details" button → alert detail page (PRP-04/05)

### 8.5 Info Card Overlay

- [ ] Bottom sheet component on marker tap
- [ ] Shows: pet photo, name/breed, distance, time ago, reward badge
- [ ] Quick actions: "I Saw This Pet", "Contact", "Share"

### 8.6 Watch Zone Feature

- [ ] Create `user_watch_zones` table
- [ ] Long-press on map to create a watch zone (circular area)
- [ ] New alerts in watch zone trigger LINE push (via PRP-06)

```sql
CREATE TABLE IF NOT EXISTS user_watch_zones (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  center_geog geography(Point, 4326) NOT NULL,
  radius_km int NOT NULL CHECK (radius_km BETWEEN 1 AND 25),
  species_filter text[] DEFAULT ARRAY['dog', 'cat'],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_watch_zones_geog ON user_watch_zones USING GIST (center_geog);
```

### 8.7 Heatmap Toggle

- [ ] Add heatmap layer using `leaflet.heat` plugin
- [ ] Toggle between marker view and heatmap view
- [ ] Heatmap data from same bbox query

---

## Verification

```bash
npm run test
npm run type-check
```

- [ ] Map loads centered on user's GPS location
- [ ] Lost alerts show as red-bordered photo markers
- [ ] Found reports show as blue-bordered photo markers
- [ ] Markers cluster when zoomed out, expand on zoom in
- [ ] Radius selector filters visible markers
- [ ] Panning map loads new markers via bbox query
- [ ] Tapping marker opens info card with correct data
- [ ] Heatmap toggle works
- [ ] Performance: map renders <100 markers without jank on mobile

---

## Confidence Score: 8/10

**Risk areas:**
- Circular photo markers require custom CSS in Leaflet DivIcon (fiddly)
- MarkerCluster performance with 500+ markers on mobile LIFF
- Bbox query on map pan generates many requests — needs debounce + caching
- `leaflet.heat` may have bundle size impact

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Interactive discovery map with pet photo markers |
