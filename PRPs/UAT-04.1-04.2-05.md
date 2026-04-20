# UAT Checklist — PRP-04.1 + PRP-04.2 + PRP-05 Combined

**Branch:** `feature/prp-04.1-04.2-05-combined`
**Date:** 2026-04-14
**Tester:** _______________

> **Legend:**
> - `[AUTO]` = this case is already checked by automated tests (CI). You do not need to verify it manually.
> - No tag = manual check required — follow the steps below.

---

## Test Data — Use These Exact Values

Prepare the following before starting. Having them ready means you never need to think about what to type.

| Item | Value to use |
|------|-------------|
| **Account A (pet owner)** | Your main test LINE account |
| **Account B (finder)** | A second LINE account (friend's phone or test device) |
| **Pet name** | บัดดี้ |
| **Pet species** | สุนัข |
| **Pet breed** | ลาบราดอร์ |
| **Lost location** | สวนลุมพินี กรุงเทพฯ |
| **Lost date** | วันนี้ (today) |
| **Distinguishing marks** | มีปื้นขาวที่หน้าอก ใส่ปลอกสีแดง |
| **Reward amount** | 1,000 บาท |
| **Contact phone** | 081-234-5678 |
| **Opt-in to show phone on poster** | ✅ ติ๊กถูก (checked) |
| **Voice prompt to record** | พูดว่า: "บัดดี้ๆ มาหาแม่หน่อยนะลูก" |
| **Found pet location** | หน้า 7-Eleven ซอยสุขุมวิท 23 |
| **Found pet description** | สุนัข / สีน้ำตาลทอง / ขนาดกลาง / สุขภาพดี |
| **Shelter name** (if needed) | บ้านพักสัตว์เลี้ยงหัวใจ |
| **Shelter address** (if needed) | 99/1 ถนนลาดพร้าว แขวงจอมพล |
| **Secret detail** | ปลอกสีแดงมีชื่อ "บัดดี้" สลักไว้ด้านใน |
| **Sighting note** | เห็นน้องวิ่งอยู่แถวป้ายรถเมล์ ตอนประมาณ 15.00 น. |
| **Long pet name (for Thai text test)** | น้องมะลิจอมซนแห่งบางบัวทอง |
| **Mixed-language description** | ขนสีน้ำตาล 🐶 Brown Lab ลาบราดอร์ |

---

## Prerequisites — Do This Before Starting Any Test

- [ ] Start the dev server: open your terminal and run `npm run dev`, wait until you see "Ready"
- [ ] Open the app in your browser at `http://localhost:3000` — or open via LINE LIFF
- [ ] Log in with **Account A** (the pet owner account)
- [ ] Make sure Account A has at least 1 pet registered (name: **บัดดี้**, species: สุนัข)
  - If not: go to `/pets` → tap "เพิ่มสัตว์เลี้ยง" → fill in the data above → save
- [ ] Have **Account B** (the second account) ready on another device or incognito window

---

## Test 1: Voice Recording in Lost Pet Wizard (PRP-04.2)

**Where to go:** Navigate to `/post/lost` or tap "แจ้งสัตว์เลี้ยงหาย" from the home screen.

**What this tests:** The wizard for reporting a lost pet now has a voice recording step. The owner records their voice calling the pet's name — a stranger who finds the pet can play this audio to calm the animal.

---

- [ ] **1.1** Tap the red button labeled **"แจ้งสัตว์เลี้ยงหาย"** on the home screen or `/post/lost`.
  - ✅ Expected: A wizard/form opens. You see Step 0.

- [ ] **1.2** Step 0 — Select your pet:
  - Tap **"บัดดี้"** from the pet list.
  - Tap **"ถัดไป"** (Next).
  - ✅ Expected: Moves to Step 1.

- [ ] **1.3** Step 1 — Location + Date:
  - Location: tap the map, drag the pin to **สวนลุมพินี**, or type "สวนลุมพินี กรุงเทพฯ" in the location field.
  - Date: select **today's date**.
  - Tap **"ถัดไป"**.
  - ✅ Expected: Moves to Step 2.

- [ ] **1.4** Step 2 — Distinguishing marks:
  - Type in the text field: **"มีปื้นขาวที่หน้าอก ใส่ปลอกสีแดง"**
  - Tap **"ถัดไป"**.
  - ✅ Expected: Moves to Step 3 (Voice Recording screen).

- [ ] **1.5** Step 3 — Voice Recording screen. Verify ALL of these appear:
  - [ ] A header that says **"บันทึกเสียง"**
  - [ ] Text that mentions your pet's name **"บัดดี้"** in the prompt
  - [ ] A round microphone (🎙) button to start recording
  - [ ] A checkbox for consent (something like "ยินยอมให้อัปโหลดเสียง...")
  - [ ] A note that says you can skip (something like "คุณสามารถข้ามขั้นตอนนี้ได้")

- [ ] **1.6** Tap the **microphone button** to start recording. `[AUTO: Vitest]`
  - ✅ Expected: A red dot or red circle appears, and a countdown timer starts (counts down from 30 seconds).

- [ ] **1.7** Speak for 3–5 seconds: say **"บัดดี้ๆ มาหาแม่หน่อยนะลูก"**, then tap the **stop button**. `[AUTO: Vitest]`
  - ✅ Expected: Recording stops. You see a playback button appear.

- [ ] **1.8** Tap the **play button** (▶) to listen back. `[AUTO: Vitest]`
  - ✅ Expected: You hear your own voice saying "บัดดี้ๆ มาหาแม่หน่อยนะลูก".

- [ ] **1.9** Tap **"บันทึกใหม่"** or **"อัดใหม่"** (Re-record). `[AUTO: Vitest]`
  - ✅ Expected: The previous recording is cleared. The microphone button is active again, ready to record.

- [ ] **1.10** Tick the **consent checkbox**: "ยินยอมให้อัปโหลดเสียง..." `[AUTO: Vitest]`
  - ✅ Expected: Checkbox is checked (✅). The "Next" button becomes active (not greyed out).

- [ ] **1.11** **Skip test** — clear the recording (tap "ลบ" or re-record then don't save), then tap **"ถัดไป"** WITHOUT ticking consent.
  - ✅ Expected: The wizard still moves to the next step (voice is optional — you are not blocked).

- [ ] **1.12** Step 4 — Reward + Contact:
  - Reward: type **1000**
  - Contact phone: type **081-234-5678**
  - Tick the checkbox to show phone on poster (opt-in).
  - Tap **"ถัดไป"**.
  - ✅ Expected: Moves to Step 5 (Review).

- [ ] **1.13** Step 5 — Review screen:
  - Verify all the information you entered is shown:
    - Pet name: บัดดี้
    - Location: สวนลุมพินี
    - Marks: มีปื้นขาวที่หน้าอก ใส่ปลอกสีแดง
    - Reward: 1,000 บาท
  - Tap **"ส่งประกาศ"** (Submit).
  - ✅ Expected: A loading spinner appears briefly, then a success screen.

- [ ] **1.14** Success screen appears with a shareable link. `[AUTO: Playwright]`
  - ✅ Expected: You see buttons like "คัดลอกลิงก์" (Copy link) and/or "แชร์ผ่าน LINE".
  - Copy the link URL — you will need it for Test 2.

---

## Test 2: Poster & Share Card on Detail Page (PRP-04.1)

**Where to go:** Open the alert you just created. Either tap the link from Test 1 success screen, or go to `/post` and find the alert you created.

**What this tests:** The alert owner can generate a printable A4 PDF poster ("หมาหาย!") and a shareable JPEG image. Non-owners cannot see these buttons.

---

- [ ] **2.1** Open the alert detail page for **บัดดี้** (the one you just created in Test 1).
  - Tip: tap the link copied from the success screen, or go to `/post` → tap the card with บัดดี้.
  - ✅ Expected: The alert detail page loads. You see the pet photo, name, location, etc.

- [ ] **2.2** Scroll to the **bottom** of the page.
  - ✅ Expected: You see a card or section with two buttons:
    - **"สร้างโปสเตอร์"** (with a document/📄 icon)
    - **"ดาวน์โหลดรูปแชร์"** (with an image/🖼 icon)

- [ ] **2.3** Tap **"สร้างโปสเตอร์"**. `[AUTO: Vitest]`
  - ✅ Expected: A loading spinner appears on the button while the PDF is being generated.

- [ ] **2.4** Wait up to 10 seconds. `[AUTO: Playwright]`
  - ✅ Expected: A PDF file downloads automatically to your device (check Downloads folder).

- [ ] **2.5** Open the downloaded PDF and verify all of the following:
  - [ ] Large red text at the top says **"หมาหาย!"** (because บัดดี้ is a dog — would say "แมวหาย!" for a cat)
  - [ ] A photo of บัดดี้ is displayed prominently in the middle
  - [ ] The pet name **"บัดดี้"** appears in large text
  - [ ] Reward **"1,000 บาท"** is shown in red or gold color
  - [ ] Lost date (today's date) is present
  - [ ] Location **"สวนลุมพินี กรุงเทพฯ"** is present
  - [ ] A QR code is visible — scan it with your phone camera and confirm it opens the page `/post/[id]`
  - [ ] Phone number **"081-234-5678"** is shown in large text (because we opted in)
  - [ ] An emotional Thai CTA appears at the bottom (e.g., "ขอความเมตตา...")
  - [ ] Small Pawrent logo/branding visible in a corner

- [ ] **2.6** Go back to the alert detail page. Tap **"ดาวน์โหลดรูปแชร์"**.
  - ✅ Expected: A loading spinner appears on the button.

- [ ] **2.7** Wait up to 10 seconds. `[AUTO: Playwright]`
  - ✅ Expected: A JPEG image file downloads to your device.

- [ ] **2.8** Open the downloaded JPEG image and verify:
  - [ ] The image is **portrait** orientation (taller than wide — similar to a phone screenshot)
  - [ ] Approximate size around 1080×1350 pixels (check image properties)
  - [ ] Bold Thai-style design: red banner at top, pet photo, pet name, QR code
  - [ ] Thai text is sharp and readable (not blurry or pixelated)
  - [ ] You could comfortably read this while scrolling through a LINE chat

- [ ] **2.9** **Non-owner test**: Open the same alert URL in an incognito/private browser window, or log in as **Account B**. `[AUTO: Vitest]`
  - ✅ Expected: The **"สร้างโปสเตอร์"** and **"ดาวน์โหลดรูปแชร์"** buttons are **NOT visible** — they are hidden for non-owners.

---

## Test 3: Found Pet Report Form (PRP-05)

**Where to go:** Start at `/post` (Community Hub).

**What this tests:** A stranger who found a pet can quickly report it with a photo and location. This is the "found" counterpart to the lost pet report.

---

- [ ] **3.1** Go to `/post`. Tap the **"พบ"** tab (green dot). `[AUTO: Playwright]`
  - ✅ Expected: The tab switches to show found reports (or an empty state if none exist yet).

- [ ] **3.2** Tap the **green floating button** labeled **"แจ้งพบสัตว์เลี้ยง"**. `[AUTO: Playwright]`
  - ✅ Expected: A form/wizard opens at `/post/found`.

- [ ] **3.3** Step 0 — Photo + Location:
  - Photo upload: tap **"อัพโหลดรูปภาพ"** and select 1 photo from your gallery. `[AUTO: Vitest]`
    - ✅ Expected: A thumbnail preview appears with an **"×"** (remove) button.
  - Try removing the photo: tap the **"×"** button. `[AUTO: Vitest]`
    - ✅ Expected: Photo preview disappears.
  - Upload the photo again (you need at least 1).
  - Location: allow GPS to auto-detect, or manually drag the map pin to **ซอยสุขุมวิท 23**.
  - Tap **"ถัดไป"**.

- [ ] **3.4** Step 1 — Description: `[AUTO: Vitest]`
  - Species: tap **"สุนัข"**
  - Breed guess: type **"ลาบราดอร์ สีน้ำตาลทอง"**
  - Color: type **"น้ำตาลทอง"**
  - Size: tap **"กลาง"**
  - Condition: tap **"สุขภาพดี"**
  - Collar: toggle ON the collar switch → type **"ปลอกสีแดง"** in the collar description field
  - ✅ Expected: All fields accept input. Collar description field appears only after toggling collar ON.
  - Tap **"ถัดไป"**.

- [ ] **3.5** Step 2 — Custody + Verification: `[AUTO: Vitest]`
  - Custody: tap **"ส่งสถานสงเคราะห์"** (Dropped at shelter)
    - ✅ Expected: Two new fields appear — "ชื่อสถานสงเคราะห์" and "ที่อยู่สถานสงเคราะห์"
    - Shelter name: type **"บ้านพักสัตว์เลี้ยงหัวใจ"**
    - Shelter address: type **"99/1 ถนนลาดพร้าว แขวงจอมพล"**
  - Secret verification detail: look for a field labeled something like "รายละเอียดที่ซ่อนไว้" or "บอกสิ่งที่เจ้าของจะรู้เท่านั้น"
    - Type: **"ปลอกสีแดงมีชื่อ บัดดี้ สลักไว้ด้านใน"**
    - ✅ Expected: Field is present. There is a note explaining this is anti-scam protection and the detail won't be shown publicly.
  - Tap **"ถัดไป"**.

- [ ] **3.6** Step 3 — Review: `[AUTO: Vitest]`
  - ✅ Expected: A summary card shows ALL the information you entered:
    - Photo thumbnail
    - Species: สุนัข / Breed: ลาบราดอร์
    - Size: กลาง / Condition: สุขภาพดี
    - Collar: ปลอกสีแดง
    - Custody: ส่งสถานสงเคราะห์ → บ้านพักสัตว์เลี้ยงหัวใจ
    - Location on map

- [ ] **3.7** Tap **"ส่งรายงาน"** (Submit). `[AUTO: Playwright]`
  - ✅ Expected: A success screen appears with a shareable link to the found report.

---

## Test 4: Community Hub — Found Tab (PRP-05)

**Where to go:** `/post`

**What this tests:** The Found tab in the community hub now shows real found pet reports (not a placeholder). Cards are green-themed and link to detail pages.

---

- [ ] **4.1** Go to `/post`. `[AUTO: Playwright]`
  - ✅ Expected: Community hub loads. You see tabs: "หาย" | "พบ" | "ทั้งหมด".

- [ ] **4.2** Tap the **"พบ"** tab (look for a green dot or green highlight). `[AUTO: Playwright]`
  - ✅ Expected: Tab switches. The content area updates.

- [ ] **4.3** Verify a found report card (from Test 3) appears with: `[AUTO: Vitest]`
  - [ ] A green **"พบ"** chip/badge on the card
  - [ ] A 🐕 or 🐈 species emoji
  - [ ] A photo of the found pet
  - [ ] Location text (e.g., ซอยสุขุมวิท 23)
  - [ ] Time/date it was reported
  - [ ] A custody status badge (e.g., "ส่งสถานสงเคราะห์")

- [ ] **4.4** Empty state test — if there are NO found reports: `[AUTO: Vitest]`
  - ✅ Expected: You see a paw icon and text like **"ยังไม่มีรายงาน"** (no reports yet).
  - *(Skip this step if you see the found report from Test 3.)*

- [ ] **4.5** Tap the found report card you created in Test 3.
  - ✅ Expected: Navigates to the found report detail page. Photo, description, location map, and custody status all visible.

- [ ] **4.6** Check the floating CTA button changes per tab: `[AUTO: Vitest]`
  - On **"พบ"** tab: the floating button should be **green** and say **"แจ้งพบสัตว์เลี้ยง"**
  - Tap **"หาย"** tab: the floating button should switch to **red** and say **"แจ้งสัตว์เลี้ยงหาย"**
  - ✅ Expected: Button label and color change when switching tabs.

- [ ] **4.7** While on the **"หาย"** tab, check that lost alerts still load. `[AUTO: Playwright]`
  - ✅ Expected: The บัดดี้ alert from Test 1 is still visible. Nothing is broken.

- [ ] **4.8** Tap **"ทั้งหมด"** tab. `[AUTO: Vitest]`
  - ✅ Expected: You see both lost alerts (red "หาย" chip) and found reports (green "พบ" chip) mixed together.

---

## Test 5: Contact Bridge Chat (PRP-05)

**Where to go:** `/conversations`

**What this tests:** A lost pet owner and a found pet reporter can chat anonymously — neither sees the other's personal contact info.

> **Setup:** You need **Account A** (the lost pet owner — บัดดี้ alert from Test 1) and **Account B** (a second device/account).

---

- [ ] **5.1** Using **Account B** on the second device: go to `/post/found` and create a found report for a dog seen near สวนลุมพินี.
  - Fill in any reasonable details (photo + location minimum).
  - Note the found report ID from the success screen URL (e.g., `/post/found/abc-123` → ID is `abc-123`).

- [ ] **5.2** Using **Account A**: initiate a conversation. `[AUTO: Vitest]`
  - This may be via a button on the found report detail page, or via the API. Ask the dev team for the exact trigger if the UI button is not yet visible.
  - ✅ Expected: A conversation is created linking Account A's alert with Account B's found report.

- [ ] **5.3** Using **Account A**: go to `/conversations`. `[AUTO: Playwright]`
  - ✅ Expected: A conversation list loads. You see one conversation entry.

- [ ] **5.4** Tap the conversation. `[AUTO: Playwright]`
  - ✅ Expected: A chat UI loads. You see a message input box at the bottom.

- [ ] **5.5** First-time safety tips modal:
  - ✅ Expected: On first open, a modal/popup appears with safety advice:
    - [ ] "อย่าโอนเงินก่อนพบกัน" (Never send money before meeting)
    - [ ] "นัดพบในที่สาธารณะ" (Meet at a public place)
  - Tap **"เข้าใจแล้ว"** or **"ปิด"** to dismiss the modal.
  - ✅ Expected: Modal closes. You see the chat interface.

- [ ] **5.6** Type a message: **"สวัสดีครับ น้องที่คุณพบเหมือนบัดดี้ของผมเลยครับ"** `[AUTO: Playwright]`
  - Tap **ส่ง** or press Enter.
  - ✅ Expected: Your message appears in the chat with a timestamp.

- [ ] **5.7** Switch to **Account B** on the second device. Go to `/conversations`.
  - ✅ Expected: Account B sees the same conversation. The message from Account A is visible.
  - Account B types a reply: **"ใช่เลยค่ะ มีปลอกสีแดงด้วย ตอนนี้ฝากไว้ที่สถานสงเคราะห์แล้ว"**
  - ✅ Expected: Reply appears in the chat for both accounts.

- [ ] **5.8** Verify privacy — look at all visible information in the conversation: `[AUTO: Vitest]`
  - ✅ Expected: You do NOT see the other person's LINE ID, phone number, or email. Only their display name (if shared) or an anonymous label is shown.

---

## Test 6: Regression Checks

**What this tests:** Making sure existing features still work after the new code was added.

---

- [ ] **6.1** Go to `/post`. Tap **"หาย"** tab.
  - ✅ Expected: The บัดดี้ lost alert from Test 1 is still listed correctly. No data loss or display errors.

- [ ] **6.2** Open the บัดดี้ alert detail page. Scroll through the entire page. `[AUTO: Vitest]`
  - ✅ Expected: All sections render — pet photo, name, location, status chip, map, description, action buttons. No blank sections or errors.

- [ ] **6.3** LINE Rich Menu — test all navigation buttons:
  - Tap "หน้าหลัก" → ✅ opens home page
  - Tap "ชุมชน" → ✅ opens `/post`
  - Tap "สัตว์เลี้ยง" → ✅ opens `/pets`
  - Tap "โปรไฟล์" → ✅ opens `/profile`
  - ✅ Expected: All Rich Menu buttons navigate correctly. Nothing is broken.

- [ ] **6.4** Go to `/profile`.
  - ✅ Expected: Your profile page loads with your name, LINE avatar, and any pet info. No errors.

- [ ] **6.5** Go to `/pets`. Tap **"เพิ่มสัตว์เลี้ยง"** (Add Pet).
  - Fill in a test name: **"แมวทดสอบ"**, species: แมว.
  - Save.
  - ✅ Expected: New pet appears in the list. Then delete it (tap edit → delete) to clean up.

---

## Test 7: Basic Edge Cases

**What this tests:** The app handles unusual or minimal input gracefully without crashing.

---

- [ ] **7.1** Voice recording auto-stops at 30 seconds. `[AUTO: Vitest]`
  - In the wizard at Step 3, tap Record and wait (do not tap Stop).
  - ✅ Expected: Recording stops automatically when the countdown reaches 0:00. No crash.

- [ ] **7.2** Poster without pet photo. `[AUTO: Vitest]`
  - Create a new lost pet alert but skip uploading a pet photo.
  - After submitting, go to the alert detail and tap **"สร้างโปสเตอร์"**.
  - ✅ Expected: A PDF still generates (may show a placeholder image). No error or crash.

- [ ] **7.3** Found report with minimal data — just 1 photo + location. `[AUTO: Vitest]`
  - Go to `/post/found`. Upload only 1 photo, set location. Leave ALL other fields blank.
  - Tap through to submit.
  - ✅ Expected: Report submits successfully. Success screen appears.

- [ ] **7.4** Non-authenticated access. `[AUTO: Playwright]`
  - Open a new private/incognito browser window (not logged in).
  - Go to `http://localhost:3000/post/found`.
  - ✅ Expected: You are redirected to a login page, or you see an error message saying you need to log in first. You cannot access the form without being logged in.

---

## Test 8: PDPA Compliance

**What this tests:** Legal data protection requirements. These are critical — failure means the app is not legally compliant. `[AUTO: Vitest — all 4 cases]`

---

- [ ] **8.1** Voice consent gate.
  - In the wizard, record your voice but do **NOT** tick the consent checkbox.
  - Try to tap **"ถัดไป"** or submit.
  - ✅ Expected: The upload does NOT proceed. You see a message requiring you to tick the consent box first.

- [ ] **8.2** Poster without phone opt-in.
  - Create a new lost pet alert. In the reward/contact step, leave the "แสดงเบอร์โทรบนโปสเตอร์" checkbox **unticked**.
  - Generate the poster (tap "สร้างโปสเตอร์").
  - Open the PDF.
  - ✅ Expected: Phone number **081-234-5678** does NOT appear anywhere. Only the QR code is shown.

- [ ] **8.3** Poster with phone opt-in.
  - Create a new lost pet alert. This time **tick** the "แสดงเบอร์โทรบนโปสเตอร์" checkbox and enter **081-234-5678**.
  - Generate the poster.
  - ✅ Expected: Phone number **081-234-5678** is printed in large, clear text on the poster.

- [ ] **8.4** Secret detail hidden from public.
  - Open the found report you created in Test 3.
  - Look at the entire page — all text visible on screen.
  - ✅ Expected: **"ปลอกสีแดงมีชื่อ บัดดี้ สลักไว้ด้านใน"** (the secret detail you entered in 3.5) does NOT appear anywhere on the page. It is completely hidden from public view.

---

## Test 9: Mobile / LIFF WebView

**What this tests:** Behavior inside the LINE app's built-in browser on a real phone. These cannot be automated.

> **Device required:** A real iOS or Android phone with LINE installed. Open the app via LINE's Rich Menu, not a desktop browser.

---

- [ ] **9.1** On your phone via LINE: open the lost pet wizard (tap "แจ้งสัตว์เลี้ยงหาย" from the Rich Menu).
  - Go to Step 3 (Voice Recording).
  - Tap the **record button**.
  - ✅ Expected: The microphone starts recording. If your phone doesn't support it, you see a friendly message like "เบราว์เซอร์นี้ไม่รองรับการบันทึกเสียง กรุณาเปิดบน Chrome/Safari แทน" — this is acceptable.

- [ ] **9.2** On your phone via LINE: open a lost alert detail page.
  - Tap **"สร้างโปสเตอร์"**.
  - ✅ Expected: A PDF saves to your phone (appears in Files or Downloads app). May prompt "Open in..." on iOS.

- [ ] **9.3** Download the JPEG share card on your phone.
  - Go to the alert detail → tap "ดาวน์โหลดรูปแชร์".
  - Open LINE. Start a chat with a friend. Share the downloaded image.
  - ✅ Expected: The image appears correctly in LINE chat — not a broken thumbnail, not a plain link.

- [ ] **9.4** On your phone via LINE: start a found pet report at `/post/found`.
  - When the location step loads, tap "ใช้ตำแหน่งปัจจุบัน" (Use current location).
  - ✅ Expected: Your phone asks for location permission. If you allow it, the map pin moves to your current position. If you deny it, you can manually drag the pin — this also works correctly.

---

## Test 10: Error Handling & Rate Limits

**What this tests:** The app shows clear Thai-language error messages and doesn't crash when something goes wrong.

---

- [ ] **10.1** Offline poster test:
  - Open a lost alert detail page.
  - On your computer: disconnect from WiFi or enable airplane mode.
  - Tap **"สร้างโปสเตอร์"**.
  - ✅ Expected: An error message appears (in Thai) — something like **"ไม่สามารถสร้างได้ กรุณาลองใหม่"**. The page does NOT crash or freeze permanently.
  - Reconnect your network after this test.

- [ ] **10.2** Voice upload too large. `[AUTO: Vitest]`
  - *(Automated — no manual action needed.)*

- [ ] **10.3** Found report rate limit. `[AUTO: Vitest]`
  - *(Automated — no manual action needed.)*

- [ ] **10.4** Duplicate conversation dedup. `[AUTO: Vitest]`
  - *(Automated — no manual action needed.)*

---

## Test 11: Cross-Feature Interaction

**What this tests:** Features from 04.1, 04.2, and 05 work together without breaking each other.

---

- [ ] **11.1** Create a lost alert WITH a voice recording (complete Test 1 fully, including the voice step with consent ticked). Then go to the alert detail and tap **"สร้างโปสเตอร์"**.
  - ✅ Expected: The PDF generates successfully. The voice recording does not break poster generation in any way.

- [ ] **11.2** Navigation: Found tab → card → detail → back button. `[AUTO: Playwright]`
  - Go to `/post` → tap "พบ" tab → tap a found report card → tap the back arrow (← or "กลับ").
  - ✅ Expected: You return to the **"พบ"** tab — not to the "หาย" tab. The tab selection is preserved.

- [ ] **11.3** Alert with 3+ photos and poster:
  - Create a lost alert and upload **3 photos** for the pet.
  - Go to the alert detail → tap **"สร้างโปสเตอร์"**.
  - ✅ Expected: The poster generates successfully using the first photo. No crash or error.

- [ ] **11.4** Resolved alert + poster:
  - Open an existing lost alert.
  - Tap **"กลับบ้านแล้ว"** (mark as resolved/returned home).
  - After resolving, go back to the detail page.
  - Look at the poster button area.
  - ✅ Expected: Either the poster buttons still work normally, OR they are hidden/disabled with a clear explanation. Either is acceptable — it must not crash.

---

## Test 12: Thai Text Rendering

**What this tests:** Thai characters appear correctly in generated PDF and JPEG files — no broken boxes (tofu), no cut-off text.

---

- [ ] **12.1** Open the poster PDF from Test 2.5.
  - Zoom in to read the Thai text carefully.
  - ✅ Expected: Every Thai character renders correctly. Specifically check:
    - **"หมาหาย!"** — all letters clear
    - **"รางวัล"** — all letters clear
    - **"ขอความเมตตา"** (or similar Thai emotional phrase at the bottom)
    - No characters appear as empty boxes □ or question marks ?

- [ ] **12.2** Open the JPEG share card from Test 2.7.
  - View at full size on your phone.
  - ✅ Expected: Thai text is sharp, not blurry or pixelated. Text does not get cut off at the edges.

- [ ] **12.3** Long Thai name test. `[AUTO: Vitest]`
  - Create a new lost alert with pet name: **"น้องมะลิจอมซนแห่งบางบัวทอง"** (this is an unusually long name).
  - Generate the poster.
  - ✅ Expected: The pet name fits on the poster — it either wraps to a second line or is truncated with "..." — it does NOT overflow outside the border or overlap other elements.

- [ ] **12.4** Mixed characters test. `[AUTO: Vitest]`
  - Create a lost alert with the distinguishing marks field set to: **"ขนสีน้ำตาล 🐶 Brown Lab ลาบราดอร์"** (Thai + emoji + English mixed).
  - Generate the poster.
  - ✅ Expected: The poster generates without error. Mixed text displays acceptably.

---

## Test 13: Sighting Reports (PRP-05)

**What this tests:** Anyone can report "I saw this pet" on an existing lost alert — adding a location pin and note.

---

- [ ] **13.1** Log in as **Account B** (not the owner of บัดดี้). Open the บัดดี้ lost alert detail page.
  - Scroll through the page.
  - ✅ Expected: There is a button like **"ฉันเห็นน้อง!"** or **"รายงานการพบเห็น"** (I saw this pet). The button is visible to non-owners.

- [ ] **13.2** Tap the sighting button.
  - ✅ Expected: A form or bottom sheet opens with:
    - [ ] A photo upload (optional — you can skip it)
    - [ ] A GPS map pin (auto-detects or drag manually)
    - [ ] A text note field
  - Fill in: Note = **"เห็นน้องวิ่งอยู่แถวป้ายรถเมล์ ตอนประมาณ 15.00 น."**
  - Set location to anywhere near สวนลุมพินี.

- [ ] **13.3** Tap **"ส่งรายงาน"** (Submit sighting). `[AUTO: Vitest]`
  - ✅ Expected: A success message appears. The sighting is saved.

- [ ] **13.4** Resolved alert rejection. `[AUTO: Vitest]`
  - Open a resolved/inactive alert (one that has been marked "กลับบ้านแล้ว").
  - Try to submit a sighting on it.
  - ✅ Expected: The sighting is rejected — you see an error like "ประกาศนี้ปิดแล้ว" (alert is closed). You cannot add sightings to resolved alerts.

- [ ] **13.5** After submitting the sighting (Test 13.3), reload the บัดดี้ alert detail page. `[AUTO: Vitest]`
  - ✅ Expected: A sighting pin or marker appears on the map at the location you reported. *(Note: this requires the map feature to be implemented — if the pin is not visible, record as a known gap.)*

---

## Test 14: Voice Playback for Finders (PRP-04.2)

> **Core use case:** A stranger finds a lost pet. They open the alert, download the owner's voice recording, and play it near the scared animal. The familiar voice calms the pet.

---

- [ ] **14.1** Log in as **Account B**. Open the บัดดี้ alert (which has a voice recording from Test 1). `[AUTO: Vitest]`
  - Scroll to the voice player section.
  - ✅ Expected: You see a section titled something like **"🔊 เสียงเจ้าของเรียกน้อง บัดดี้"** with a download button and a play button.

- [ ] **14.2** Tap the **download button** (📥 "ดาวน์โหลดเสียงเจ้าของ"). `[AUTO: Playwright]`
  - ✅ Expected: An audio file (`.m4a` format) downloads to your device.

- [ ] **14.3** On your phone: find the downloaded audio file in your Files app. Open it.
  - ✅ Expected: Your phone's native music/audio player opens and plays the recording. You hear "บัดดี้ๆ มาหาแม่หน่อยนะลูก" clearly.

- [ ] **14.4** Back on the alert page: tap the **inline play button** (▶). `[AUTO: Vitest]`
  - ✅ Expected: The audio plays in the browser. *(Note: playback in LINE LIFF WebView may be unreliable — if it doesn't play in LIFF, that is expected. The download button in 14.2 is the primary option.)*

- [ ] **14.5** Scroll and find the instruction text below the player.
  - ✅ Expected: You see text that says something like: **"หากพบน้อง ให้กดดาวน์โหลดแล้วเปิดเสียงใกล้ๆ น้อง เสียงเจ้าของจะช่วยให้น้องสงบลง"**

- [ ] **14.6** Open a different lost alert that has **NO voice recording**. `[AUTO: Vitest]`
  - ✅ Expected: The voice player section is **completely hidden** — you do not see an empty box, a broken player, or any voice-related content.

---

## Test 15: Found Report Detail Page (PRP-05)

**Where to go:** Tap a found report card → detail page.

**What this tests:** The found report detail page shows all public info, hides the secret field, and shows owner controls only to the reporter.

---

- [ ] **15.1** From the "พบ" tab, tap the found report you created in Test 3. `[AUTO: Vitest]`
  - ✅ Expected: A detail page loads showing:
    - Pet photo
    - Species/breed/color description
    - Custody status: "ส่งสถานสงเคราะห์" + shelter name/address
    - A location map
    - Time reported

- [ ] **15.2** Carefully read ALL text visible on the page. `[AUTO: Vitest — security gate]`
  - ✅ Expected: **"ปลอกสีแดงมีชื่อ บัดดี้ สลักไว้ด้านใน"** (the secret detail from Test 3.5) does NOT appear anywhere. This field must be completely hidden from all viewers.

- [ ] **15.3** While logged in as **Account B** (the reporter who created this found report), view the detail page.
  - ✅ Expected: You see **"แก้ไข"** (Edit) and **"ลบ"** (Delete) options somewhere on the page — in a menu, button, or kebab (**⋮**) icon. `[AUTO: Vitest]`

- [ ] **15.4** Log in as **Account A** (who did NOT create this found report). View the same found report detail page.
  - ✅ Expected: The **"แก้ไข"** and **"ลบ"** options are **NOT visible** at all. `[AUTO: Vitest]`

---

## Test 16: Wizard Navigation

**What this tests:** Tapping the back arrow in a wizard goes to the previous step — it doesn't exit the wizard. Form data you already filled in is preserved.

---

- [ ] **16.1** Open the lost pet wizard (`/post/lost`). Fill in Steps 0 and 1. On Step 2, tap the **back arrow (←)**.
  - ✅ Expected: You return to **Step 1** (Location + Date) — not to the home screen. Your location and date are still there.

- [ ] **16.2** Open the found pet wizard (`/post/found`). Fill in Steps 0 and 1. On Step 2, tap the **back arrow (←)**. `[AUTO: Vitest]`
  - ✅ Expected: You return to **Step 1** (Description) — not to the home screen.

- [ ] **16.3** Lost wizard state preservation. `[AUTO: Vitest]`
  - Open the lost pet wizard. On Step 2, type: **"มีปื้นขาวที่หน้าอก"**
  - Tap **"ถัดไป"** to go to Step 3.
  - Tap back to return to Step 2.
  - ✅ Expected: The text **"มีปื้นขาวที่หน้าอก"** is still in the field. Your input was not lost.

- [ ] **16.4** Browser back button test. `[AUTO: Playwright]`
  - Open the lost pet wizard. Fill in Step 0 and 1. On Step 2, press your **browser's back button** (not the in-app arrow).
  - ✅ Expected: Either you go to Step 1 (same as in-app back), OR a confirmation dialog asks "ต้องการออกจากฟอร์มหรือไม่?" before exiting. It should NOT silently discard all your data without warning.

---

## Test 17: Infinite Scroll & Pagination

**What this tests:** When there are many reports, they load in batches as you scroll — you don't wait for all of them upfront.

> **Prerequisite:** You need more than 20 found reports in the system. If you don't have that many, ask the dev team to seed test data, or skip 17.1.

---

- [ ] **17.1** Go to `/post` → "พบ" tab. `[AUTO: Playwright]`
  - Slowly scroll to the bottom of the list.
  - ✅ Expected: When you reach the bottom, more cards automatically load. You don't need to tap a "Load more" button (though one may appear briefly as a fallback).

- [ ] **17.2** While the next page is loading (between scrolling down and new cards appearing):
  - ✅ Expected: A loading spinner or "กำลังโหลด..." appears briefly to indicate data is being fetched.

- [ ] **17.3** Go to the "หาย" tab and scroll to the bottom. `[AUTO: Playwright]`
  - ✅ Expected: Lost alerts also paginate correctly. No regression from the found tab changes.

---

## Test 18: DB Migration

**What this tests:** The database schema changes were applied correctly.

> **Requires Supabase access** — ask the dev team or run these via Supabase Studio dashboard.

---

- [ ] **18.1** After running `supabase db push`, verify these 4 tables exist in the database:
  - `found_reports`
  - `pet_sightings`
  - `conversations`
  - `messages`
  - ✅ Expected: All 4 tables are present in Supabase Studio → Table Editor.

- [ ] **18.2** RLS policies — unauthenticated insert is blocked. `[AUTO: Vitest]`
  - *(Automated — no manual action needed.)*

- [ ] **18.3** Geo-sync trigger:
  - In Supabase Studio → SQL Editor, insert a test row into `found_reports` with `lat = 13.7563` and `lng = 100.5018`.
  - After inserting, check the `geog` column of that row.
  - ✅ Expected: The `geog` column is automatically populated with a PostGIS geography point — it should not be `null`.
  - Delete the test row when done.

- [ ] **18.4** CASCADE delete:
  - In Supabase Studio, find a `pet_reports` row that has related `pet_sightings` rows.
  - Delete the `pet_reports` row.
  - ✅ Expected: All related `pet_sightings` rows are automatically deleted (CASCADE). No orphan rows remain.

---

## Test 19: Supabase Storage

**What this tests:** Files actually upload to and read from Supabase storage buckets.

> **Requires a live Supabase connection** — test on the staging or dev environment.

---

- [ ] **19.1** Complete Test 1 fully (lost pet wizard with voice recording).
  - After submission, open Supabase Studio → Storage → bucket **"voice-recordings"**.
  - ✅ Expected: A new audio file appears. Its name contains the alert ID and a timestamp (e.g., `abc-123_1744500000.m4a`).

- [ ] **19.2** Complete Test 3 (found pet report with photo).
  - After submission, open Supabase Studio → Storage → the photos bucket.
  - ✅ Expected: The photo you uploaded is present in the bucket.

- [ ] **19.3** Copy the public URL of the voice recording from Supabase Storage.
  - Open that URL in a new browser tab (while NOT logged in).
  - ✅ Expected: The audio file loads/plays publicly. You do not need to log in to access it.

- [ ] **19.4** Unauthenticated write test:
  - Try uploading a file to the `voice-recordings` bucket without being logged in (via Supabase Storage REST API or the CLI).
  - ✅ Expected: The upload is **rejected** (403 Forbidden). Only authenticated users can write to buckets.

---

## Test 20: URL Sharing & Deep Links

**What this tests:** Links to alerts and found reports work correctly when opened by anyone — including people who are not logged in.

---

- [ ] **20.1** Copy the URL of the found report from Test 3 (e.g., `http://localhost:3000/post/found/abc-123`). `[AUTO: Playwright]`
  - Open a new incognito/private browser window (not logged in).
  - Paste and open the URL.
  - ✅ Expected: The found report detail page loads normally — you can see the photo, description, and location. You are NOT redirected to a login page.

- [ ] **20.2** Copy the URL of the บัดดี้ lost alert (which has a voice recording). `[AUTO: Playwright]`
  - Open the URL in an incognito window (not logged in).
  - ✅ Expected: The alert detail loads. The voice download button **"📥 ดาวน์โหลดเสียงเจ้าของ"** is visible and works (audio downloads even without login).

- [ ] **20.3** Scan the QR code from the poster PDF (from Test 2.5) with your phone camera.
  - ✅ Expected: Your phone opens the correct URL — `https://[your-domain]/post/[alert-id]` — and the บัดดี้ alert loads.

- [ ] **20.4** On the success screen after submitting the lost alert, tap **"แชร์ผ่าน LINE"** (Share via LINE).
  - Select a LINE friend or group to share with.
  - Open LINE on your phone and view the shared message.
  - ✅ Expected: The link opens correctly inside LINE's browser. The alert detail page loads — no blank page or error.

---

## Summary

| Section | Total | Automated | Manual | Who checks manually |
|---------|-------|-----------|--------|---------------------|
| 1. Voice Recording | 14 | 5 | 9 | Tester (audio requires real device) |
| 2. Poster & Share Card | 9 | 4 | 5 | Tester (visual PDF/JPEG inspection) |
| 3. Found Pet Report | 7 | 7 | 0 | CI only |
| 4. Community Hub Found | 8 | 7 | 1 | Tester (4.5 tap navigation) |
| 5. Contact Bridge Chat | 8 | 5 | 3 | Tester (2-account flow) |
| 6. Regression | 5 | 1 | 4 | Tester (LINE Rich Menu, profile, pets) |
| 7. Basic Edge Cases | 4 | 4 | 0 | CI only |
| 8. PDPA Compliance | 4 | 4 | 0 | CI only |
| 9. Mobile / LIFF | 4 | 0 | 4 | Tester (real phone + LINE required) |
| 10. Error & Rate Limits | 4 | 3 | 1 | Tester (10.1 offline simulation) |
| 11. Cross-Feature | 4 | 1 | 3 | Tester (visual cross-checks) |
| 12. Thai Text | 4 | 2 | 2 | Tester (font rendering in PDF/JPEG) |
| 13. Sighting Reports | 5 | 3 | 2 | Tester (13.1 UI button, 13.2 form) |
| 14. Voice Playback | 6 | 3 | 3 | Tester (native audio, instruction text) |
| 15. Found Report Detail | 4 | 4 | 0 | CI only |
| 16. Wizard Navigation | 4 | 3 | 1 | Tester (16.1 lost wizard back) |
| 17. Infinite Scroll | 3 | 2 | 1 | Tester (17.2 spinner visual) |
| 18. DB Migration | 4 | 1 | 3 | Dev/Tester (Supabase Studio access) |
| 19. Supabase Storage | 4 | 0 | 4 | Dev/Tester (storage bucket access) |
| 20. URL Sharing | 4 | 3 | 1 | Tester (20.3 QR scan, 20.4 LINE) |
| **Total** | **104** | **61** | **43** | 59% automated by CI |

### Automated Test Files

**Vitest (unit/integration):**
- `__tests__/pdpa-compliance.test.ts` — Sections 8, 18.2
- `__tests__/found-report-detail.test.tsx` — Section 15
- `__tests__/found-report-form.test.tsx` — Section 3
- `__tests__/community-hub-found-tab.test.tsx` — Section 4
- `__tests__/api-conversations.test.ts` — Sections 5.2, 5.8, 10.4
- `__tests__/api-messages.test.ts` — Sections 5.6, 5.8
- `__tests__/api-sightings.test.ts` — Section 13
- `__tests__/voice-recording-extended.test.tsx` — Sections 1.6, 1.7, 1.9, 1.10, 7.1
- `__tests__/poster-voice-extended.test.tsx` — Sections 1.8, 2.3, 2.9, 14.4, 14.6
- `__tests__/sighting-reports-extended.test.ts` — Sections 13.3, 13.4, 13.5
- `__tests__/wizard-navigation.test.tsx` — Sections 16.2, 16.3
- `__tests__/error-handling-rate-limits.test.ts` — Sections 7.2, 7.3, 10.2, 10.3, 12.3, 12.4

**Playwright (E2E):**
- `e2e/found-pet-flow.spec.ts` — Sections 3.1, 3.2, 3.7, 7.4
- `e2e/poster-voice-download.spec.ts` — Sections 2.4, 2.7, 14.2
- `e2e/contact-bridge.spec.ts` — Sections 5.3, 5.4, 5.6
- `e2e/wizard-navigation.spec.ts` — Sections 1.14, 16.4
- `e2e/public-access.spec.ts` — Section 20.1
- `e2e/community-hub-found.spec.ts` — Sections 4.1, 4.2, 4.7, 11.2, 17.1, 17.3
- `e2e/unauthenticated-redirect.spec.ts` — Sections 7.4, 20.1, 20.2

**Sign-off:** _____________ **Date:** _____________
