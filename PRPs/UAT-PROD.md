# Pawrent — Production UAT Checklist

**Scope:** Confirm Lost + Found + Poster + Voice + Health Passport work on live production.
**Time:** ~60 min solo. +30 min if you have a second phone/friend.
**You do NOT need:** Terminal, database access, dev tools. Just your phone and LINE.

**Production URL:** `https://_______` _(fill in before starting)_

**How to report a bug:**
1. Screenshot the screen
2. Write down the Section + Step number (e.g., "3.2")
3. Paste into a note — send to the dev team at the end

---

## Pre-flight — Do Once Before Starting

- [ ] Open **LINE** → find **Pawrent OA** → tap the Rich Menu icon → tap **หน้าหลัก**
- [ ] You are logged in. Your name / LINE avatar is visible at `/profile`.
- [ ] Go to `/pets`. If you don't see a pet called **บัดดี้**, add one:
  - Tap **"เพิ่มสัตว์เลี้ยง"**
  - Name: **บัดดี้** · Species: **สุนัข** · Breed: **ลาบราดอร์**
  - Save
- [ ] (Optional) Ask a friend to open Pawrent on their phone for the **Part B** tests. They should also have 1 pet registered.

### Ready-to-Copy Test Data

Keep this handy — copy/paste instead of typing.

| Item | Value |
|---|---|
| Pet name | บัดดี้ |
| Species | สุนัข |
| Breed | ลาบราดอร์ |
| Lost location | สวนลุมพินี กรุงเทพฯ |
| Lost marks | มีปื้นขาวที่หน้าอก ใส่ปลอกสีแดง |
| Reward | 1000 |
| Phone | 081-234-5678 |
| Voice prompt | บัดดี้ๆ มาหาแม่หน่อยนะลูก |
| Found location | หน้า 7-Eleven ซอยสุขุมวิท 23 |
| Found description | สุนัข / สีน้ำตาลทอง / ขนาดกลาง / สุขภาพดี |
| Shelter name | บ้านพักสัตว์เลี้ยงหัวใจ |
| Shelter address | 99/1 ถนนลาดพร้าว แขวงจอมพล |
| Secret detail | ปลอกสีแดงมีชื่อ บัดดี้ สลักไว้ด้านใน |
| Sighting note | เห็นน้องวิ่งอยู่แถวป้ายรถเมล์ ตอนประมาณ 15.00 น. |
| Weight (Section 5.2) | 12.5 kg · today's date |
| Weight invalid values (Section 5.3) | 0 · 250 |
| Milestone title (Section 5.4) | วันแรกที่ไปทะเล |
| Milestone date (Section 5.4) | 2026-01-15 |
| Fake pet ID for access-control test (Section 5.5) | 00000000-0000-0000-0000-000000000000 |
| Chat message from Phone A (Section 11.5) | สวัสดีครับ น้องที่คุณพบเหมือนบัดดี้ของผมเลยครับ |
| Chat reply from Phone B (Section 11.7) | ใช่เลยค่ะ มีปลอกสีแดงด้วย ตอนนี้ฝากไว้ที่สถานสงเคราะห์แล้ว |
| Long pet name (Thai test, Section 8.3) | น้องมะลิจอมซนแห่งบางบัวทอง |
| Mixed text (Thai test, Section 8.4) | ขนสีน้ำตาล Brown Lab ลาบราดอร์ |

---

# PART A — Solo Phone Tests (~60 min)

## Section 1: Report Lost Pet (Full Wizard)

> Where: Home → red button **"แจ้งสัตว์เลี้ยงหาย"**, or open `/post/lost`

- [ ] **1.1** Tap **"แจ้งสัตว์เลี้ยงหาย"**. Wizard opens at Step 0.
- [ ] **1.2** Step 0: tap **บัดดี้** → tap **ถัดไป**.
- [ ] **1.3** Step 1: drag the map pin to **สวนลุมพินี**. Set date to **today**. Tap **ถัดไป**.
- [ ] **1.4** Step 2: type distinguishing marks `มีปื้นขาวที่หน้าอก ใส่ปลอกสีแดง`. Tap **ถัดไป**.
- [ ] **1.5** Step 3 — Voice Recording screen appears. You should see:
  - Header: **"บันทึกเสียง"**
  - Your pet's name **"บัดดี้"** in the prompt
  - A round microphone button
  - A consent checkbox
  - A note that you can skip
- [ ] **1.6** Tap the mic → red recording indicator appears + countdown starts.
- [ ] **1.7** Say **"บัดดี้ๆ มาหาแม่หน่อยนะลูก"** for ~4 seconds → tap stop. A **play** button appears.
- [ ] **1.8** Tap **play (▶)**. You hear your own voice playing back clearly.
- [ ] **1.9** Tick the consent checkbox. The **"ถัดไป"** button becomes active (not greyed out).
- [ ] **1.10** Tap **"ถัดไป"** to continue.
- [ ] **1.11** Step 4 (Reward + Contact): Reward `1000`, phone `081-234-5678`, **tick** "แสดงเบอร์โทรบนโปสเตอร์". Tap **ถัดไป**.
- [ ] **1.12** Step 5 (Review): all the info you entered is shown correctly. Tap **"ส่งประกาศ"**.
- [ ] **1.13** Success screen appears with share buttons. **Copy the link** — you need it for Section 2.

**⚠️ PDPA check:**
- [ ] **1.14** If you try to proceed from Step 3 WITHOUT ticking consent (after recording), the upload should be blocked / you cannot move on until consent is ticked.

---

## Section 2: Poster + Share Card

> Where: Open the alert you just created (paste the link from 1.13, or go to `/post` → tap บัดดี้'s card)

- [ ] **2.1** Alert detail page loads: pet photo, name บัดดี้, location, reward, status, map all visible.
- [ ] **2.2** Scroll to the **bottom** — you see two buttons:
  - **"สร้างโปสเตอร์"**
  - **"ดาวน์โหลดรูปแชร์"**
- [ ] **2.3** Tap **"สร้างโปสเตอร์"**. A spinner shows. Within 10 seconds, a PDF downloads.
- [ ] **2.4** Open the PDF. Check:
  - [ ] Large red **"หมาหาย!"** at the top
  - [ ] Photo of บัดดี้ in the middle
  - [ ] Pet name **บัดดี้** in large text
  - [ ] Reward **"1,000 บาท"** in red/gold
  - [ ] Lost date (today) + location **สวนลุมพินี กรุงเทพฯ**
  - [ ] Phone **081-234-5678** is printed (because you opted in at 1.11)
  - [ ] A QR code — scan it with your phone camera, it opens this alert's page
  - [ ] Emotional Thai CTA at the bottom (e.g., "ขอความเมตตา...")
  - [ ] Pawrent logo visible somewhere
- [ ] **2.5** Go back → tap **"ดาวน์โหลดรูปแชร์"**. Within 10 seconds a JPEG downloads.
- [ ] **2.6** Open the JPEG. Check:
  - [ ] Portrait orientation (taller than wide, around 1080×1350)
  - [ ] Red banner, pet photo, name, QR code visible
  - [ ] Thai text is **sharp** (not blurry or pixelated)

**⚠️ PDPA check — Phone opt-OUT:**
- [ ] **2.7** Create **another** lost alert. This time in Step 4 **leave the phone checkbox unticked**. Generate a poster.
- [ ] **2.8** Open the PDF — phone number **081-234-5678** does **NOT** appear anywhere. Only the QR code remains.

**Non-owner check:**
- [ ] **2.9** Open the alert URL from 1.13 in an incognito / private browser window (not logged in). The **"สร้างโปสเตอร์"** and **"ดาวน์โหลดรูปแชร์"** buttons are **NOT visible**.

---

## Section 3: Report Found Pet

> Where: `/post` → tap **"พบ"** tab (green) → tap green floating button **"แจ้งพบสัตว์เลี้ยง"**

- [ ] **3.1** Form opens at `/post/found`.
- [ ] **3.2** Step 0 — Photo + Location:
  - Upload 1 photo. Thumbnail with **×** button appears.
  - Tap **×** to remove, then re-upload.
  - Location: drag map pin to **ซอยสุขุมวิท 23** (or allow GPS).
  - Tap **ถัดไป**.
- [ ] **3.3** Step 1 — Description: Species **สุนัข**, breed `ลาบราดอร์ สีน้ำตาลทอง`, color `น้ำตาลทอง`, size **กลาง**, condition **สุขภาพดี**, toggle collar **ON** → type `ปลอกสีแดง`. Tap **ถัดไป**.
- [ ] **3.4** Step 2 — Custody + Verification:
  - Tap **"ส่งสถานสงเคราะห์"** → two new fields appear
  - Shelter name: `บ้านพักสัตว์เลี้ยงหัวใจ`
  - Shelter address: `99/1 ถนนลาดพร้าว แขวงจอมพล`
  - Secret detail: `ปลอกสีแดงมีชื่อ บัดดี้ สลักไว้ด้านใน`
    - [ ] A note appears explaining this is anti-scam (won't be shown publicly).
  - Tap **ถัดไป**.
- [ ] **3.5** Step 3 — Review shows everything. Tap **"ส่งรายงาน"**. Success screen + shareable link.

---

## Section 4: Community Hub (Both Tabs)

> Where: `/post`

- [ ] **4.1** Three tabs visible: **หาย** (lost, red) / **พบ** (found, green) / **ทั้งหมด** (all).
- [ ] **4.2** Tap **"พบ"**. Your found report from Section 3 appears as a card with:
  - Green **"พบ"** chip
  - Species emoji
  - Photo
  - Location
  - Custody badge (e.g., "ส่งสถานสงเคราะห์")
- [ ] **4.3** Tap the found card → detail page loads (photo, description, location map, custody).
- [ ] **4.4** Go back. The **"พบ"** tab is still selected (not thrown back to "หาย"). Floating button is **green** and says **"แจ้งพบสัตว์เลี้ยง"**.
- [ ] **4.5** Tap **"หาย"** tab. The floating button switches to **red** saying **"แจ้งสัตว์เลี้ยงหาย"**. The บัดดี้ alert is listed.
- [ ] **4.6** Tap **"ทั้งหมด"** tab. Both lost (red chip) and found (green chip) cards are mixed.

---

## Section 5: Pet Health Passport

> Where: `/pets` → tap บัดดี้ → tap **"Passport"** (or go to `/pets/{petId}/passport`)

- [ ] **5.1** Passport page loads with sections: pet name, vaccine area, weight chart, milestone timeline, upcoming reminders.
- [ ] **5.2** Weight tracking — scroll to **"น้ำหนัก (กก.)"**:
  - Tap **Add weight** (or ➕)
  - Enter **12.5** kg, today's date → Submit
  - A new point appears on the chart at 12.5 kg.
- [ ] **5.3** Weight validation:
  - Try entering **0** kg → submit blocked with an error message.
  - Try entering **250** kg → submit blocked with an error message.
- [ ] **5.4** Milestone timeline — scroll to **"Milestone Timeline"**:
  - Tap **Add Milestone**
  - Type: **custom** · Title: `วันแรกที่ไปทะเล` · Date: `2026-01-15`
  - Submit → the new milestone appears in the timeline with correct date/title.
- [ ] **5.5** Access control — open in a private browser window using **someone else's pet ID** (make up a UUID like `/pets/00000000-0000-0000-0000-000000000000/passport`):
  - Page redirects or shows 404. You cannot see other people's passports.

---

## Section 6: Voice Playback on Your Own Alert

> Where: open the บัดดี้ alert from Section 1

- [ ] **6.1** Scroll to the voice player section. You see **"🔊 เสียงเจ้าของเรียกน้อง บัดดี้"** with download + play buttons.
- [ ] **6.2** Tap inline **play (▶)**. Audio plays in the browser. _(In LIFF WebView playback can be unreliable — if it doesn't play inside LINE, that's expected; continue to 6.3.)_
- [ ] **6.3** Tap **"ดาวน์โหลดเสียงเจ้าของ"**. An `.m4a` file saves.
- [ ] **6.4** Open the downloaded file from your phone's Files app. Your native audio player plays it — you hear **"บัดดี้ๆ มาหาแม่หน่อยนะลูก"** clearly.
- [ ] **6.5** Instruction text below the player says something like: **"หากพบน้อง ให้กดดาวน์โหลดแล้วเปิดเสียงใกล้ๆ น้อง..."**.
- [ ] **6.6** Open a different lost alert that was created WITHOUT a voice recording. The voice player section is **completely hidden** (no empty box, no broken player).

---

## Section 7: Sharing & Public Access

- [ ] **7.1** Copy the บัดดี้ alert URL. Open in an **incognito/private browser window** (not logged in).
  - Alert detail loads normally. Voice download button works without login.
- [ ] **7.2** Copy the found report URL from Section 3. Open in incognito.
  - Found report detail loads normally (not redirected to login).
- [ ] **7.3** Secret detail privacy:
  - On the found report detail (logged in OR incognito), read every visible text.
  - [ ] **"ปลอกสีแดงมีชื่อ บัดดี้ สลักไว้ด้านใน"** does NOT appear anywhere. Completely hidden.
- [ ] **7.4** QR scan: use another phone's camera to scan the QR code on the PDF poster from 2.4. It opens the correct `/post/[alertId]` and loads บัดดี้'s alert.
- [ ] **7.5** Share via LINE: on the Section 1 success screen, tap **"แชร์ผ่าน LINE"** → pick a friend/group → open LINE on your phone → the shared message shows a preview card + working link.

---

## Section 8: Thai Text Rendering

> Look at the poster PDF and JPEG share card files you already downloaded.

- [ ] **8.1** Zoom into the PDF. Every Thai character renders cleanly:
  - **"หมาหาย!"**, **"รางวัล"**, the bottom Thai CTA
  - No empty boxes (□), no question marks (?).
- [ ] **8.2** JPEG share card: Thai text is sharp at full phone size, not cut off at edges.
- [ ] **8.3** Long-name stress test (optional):
  - Create a new lost alert with pet name `น้องมะลิจอมซนแห่งบางบัวทอง`.
  - Generate poster. The name wraps to 2 lines OR truncates with "..." — it does NOT overflow the border.
- [ ] **8.4** Mixed-char stress test (optional):
  - Create a lost alert with marks `ขนสีน้ำตาล Brown Lab ลาบราดอร์`.
  - Generate poster. No crash. Mixed text displays acceptably.

---

## Section 9: LINE App & Mobile

> These can ONLY be verified on your real phone inside the LINE app (not a desktop browser).

- [ ] **9.1** Open the Rich Menu inside LINE → tap each button and confirm:
  - **หน้าหลัก** → home page
  - **ชุมชน** → `/post`
  - **สัตว์เลี้ยง** → `/pets`
  - **โปรไฟล์** → `/profile`
- [ ] **9.2** Open the lost wizard via Rich Menu → Step 3 voice → tap record:
  - Mic starts OR a friendly message appears: `"เบราว์เซอร์นี้ไม่รองรับการบันทึกเสียง..."`.
- [ ] **9.3** Open an alert detail inside LINE → tap **"สร้างโปสเตอร์"** → PDF saves to Files / prompts "Open in..." on iOS.
- [ ] **9.4** Download the JPEG share card inside LINE → share it to a friend in LINE chat → image appears correctly in the chat (not broken thumbnail, not a bare link).
- [ ] **9.5** Open `/post/found` inside LINE → on the location step tap **"ใช้ตำแหน่งปัจจุบัน"** → permission prompt → accept or deny — both work (pin moves OR you can drag manually).

---

# PART B — With a Second Phone or Friend (~30 min, OPTIONAL)

> Skip this section if you're testing solo. Come back later with a second LINE account.

## Section 10: Sighting Report

> Role: you are **Account B** (not บัดดี้'s owner).

- [ ] **10.1** Open บัดดี้'s alert on Phone B. Scroll — you see **"ฉันเห็นน้อง!"** or **"รายงานการพบเห็น"** button.
- [ ] **10.2** Tap it → form opens with: photo upload (optional), map pin, note field.
  - Note: `เห็นน้องวิ่งอยู่แถวป้ายรถเมล์ ตอนประมาณ 15.00 น.`
  - Location: anywhere near สวนลุมพินี.
- [ ] **10.3** Submit. Success confirmation.
- [ ] **10.4** Reload บัดดี้'s alert on Phone A. A sighting pin appears on the map at the reported location. _(If the map pin isn't there yet, record as known gap.)_

## Section 11: Contact Bridge Chat

> Role: Phone A (owner of บัดดี้), Phone B (created a found report).

- [ ] **11.1** On Phone B, create a found report for a dog seen near สวนลุมพินี (minimum: 1 photo + location).
- [ ] **11.2** Start a conversation (may be a button on the found report detail, or initiated by Account A opening the finder's report).
- [ ] **11.3** On Phone A go to `/conversations` → list shows 1 entry → tap it.
- [ ] **11.4** First-time safety modal appears with:
  - [ ] **"อย่าโอนเงินก่อนพบกัน"**
  - [ ] **"นัดพบในที่สาธารณะ"**
  - Tap **"เข้าใจแล้ว"** to dismiss.
- [ ] **11.5** Type `สวัสดีครับ น้องที่คุณพบเหมือนบัดดี้ของผมเลยครับ` → Send. Message appears with timestamp.
- [ ] **11.6** Switch to Phone B → `/conversations` → same conversation → see Phone A's message.
- [ ] **11.7** Phone B replies `ใช่เลยค่ะ มีปลอกสีแดงด้วย ตอนนี้ฝากไว้ที่สถานสงเคราะห์แล้ว` → both phones see it.
- [ ] **11.8** **Privacy:** in the whole chat, you see only display names. No LINE IDs, phone numbers, or emails are visible anywhere.

## Section 12: Found Report — Owner vs Non-Owner

- [ ] **12.1** As **Phone B** (the reporter), open your own found report detail. **"แก้ไข"** and **"ลบ"** options are visible (in a menu, button, or ⋮).
- [ ] **12.2** As **Phone A** (not the reporter), open the same found report. **"แก้ไข"** and **"ลบ"** are **NOT visible**.

---

# PART C — Edge Cases (Optional, ~10 min)

- [ ] **C.1** Voice auto-stop: start recording, don't touch — it stops automatically at 0:00 (30s limit). No crash.
- [ ] **C.2** Offline poster: on the alert detail, turn off WiFi + cellular → tap **"สร้างโปสเตอร์"** → Thai error appears (e.g., **"ไม่สามารถสร้างได้ กรุณาลองใหม่"**). Page doesn't freeze. Reconnect network.
- [ ] **C.3** Minimal found report: go to `/post/found` → upload 1 photo + location, leave everything else blank → submit through. Success.
- [ ] **C.4** Resolved alert + poster: open a lost alert → tap **"กลับบ้านแล้ว"** → go back to detail. The poster buttons either still work OR are hidden/disabled with a clear explanation. No crash.
- [ ] **C.5** Multi-photo + poster: create a lost alert with 3 photos → generate poster → poster renders using the first photo, no crash.

---

# PART D — Push Notifications (Requires Dev Help)

Push notification tests need: a Supabase Database Webhook configured, a friend's profile configured with radius/species/quiet hours, and a 2nd phone to receive messages. **This is technical setup.**

**If you want to run them:** see `PRPs/UAT-06-12.md` Test 1–5 — Ask the dev team to walk you through the webhook config first. Once configured, it's just "report a lost pet on Phone A → Phone B gets a LINE message" — very simple to verify.

**Skip for now:** If push is deferred, write "SKIPPED — awaiting webhook setup" in the sign-off below.

---

# Sign-off

**Tester:** __________________ **Date:** __________ **Prod URL tested:** __________

| Part | Result | Notes / Bugs Found |
|---|---|---|
| A. Solo Phone Tests (Sections 1–9) | ⬜ PASS / ⬜ FAIL | |
| B. Two-Phone Tests (Sections 10–12) | ⬜ PASS / ⬜ FAIL / ⬜ SKIPPED | |
| C. Edge Cases | ⬜ PASS / ⬜ FAIL / ⬜ SKIPPED | |
| D. Push Notifications | ⬜ PASS / ⬜ FAIL / ⬜ SKIPPED | |

**Overall:** ⬜ GOOD TO SHIP / ⬜ BLOCKED BY BUG(S) ABOVE

---

## If You Find a Bug

1. Screenshot the screen showing the bug.
2. Note the exact Section + Step number (e.g., "Section 3.4 — secret detail field didn't save").
3. Send both to the dev team — they'll reproduce and fix.

## Related Documents

- `PRPs/UAT-04.1-04.2-05.md` — full detailed UAT including automated-coverage tags
- `PRPs/UAT-06-12.md` — full push-notifications + DB-level UAT (technical)
