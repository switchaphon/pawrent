# Task
Design 5 HTML mockup variations for Pawrent — แต่ละ variation ต้อง render ทั้ง 2 หน้าในไฟล์เดียวกัน:
  1. `/pets` — pet list / profile manager
  2. `/post/lost` — โพสต์ประกาศหาสัตว์เลี้ยงหาย

เหตุผลที่ทำคู่: `/pets` = data source, `/post/lost` = consumer ของ data นั้น (ดึง pre-registered profile มาใส่ post) → ต้องเห็นว่า design system เดียวกันรองรับทั้งสอง context ได้

# Knowledge loading (ทำก่อนเริ่มเขียนโค้ด)
1. อ่าน `PRPs/PRP-00.md` ถึง `PRPs/PRP-13.md` ตามลำดับ เพื่อเข้าใจ MVP scope
2. ถ้ามี persona หรือ scenario file ใน Knowledge folder — ใช้เป็น source of truth
3. ถ้าไม่มี persona ที่ lock แล้ว → propose 2 personas ก่อน (young urban single, family with kids) แล้ว**หยุดรอ confirm** ก่อนเริ่ม design (NNG: persona ต้อง lock ก่อน ไม่งั้น design จะเปะปะ)

# Product context
- Pawrent = PWA สำหรับเจ้าของสัตว์เลี้ยงในไทย (หมา แมว สัตว์แปลก)
- Deployment: LIFF mini-app ใน LINE เป็นหลัก + installable PWA
- Users: คนไทย 20–45 ปี mobile-first ถนัด LINE มากกว่า web browser
- Tone: อบอุ่น น่าเชื่อถือ playful นิดๆ ไม่เด็กเกิน
- Language: ไทยเป็นหลัก bilingual label เฉพาะจุดสำคัญ
- Compliance: PDPA — ต้องมี consent pattern ที่ชัด
- Core differentiator: two-sided matching engine powered by pre-registered pet profiles → `/pets` ต้อง "อยากกรอก" / `/post/lost` ต้อง "กรอกเสร็จใน 30 วินาที"

# Global navigation (lock ทุก variation ใช้เหมือนกัน)
LIFF มี top header ของ LINE สูง ~44px อยู่แล้ว → global nav ใช้ **bottom tab bar** เท่านั้น (Apple HIG: max 5 tabs)
Tabs: [หน้าหลัก][โพสต์][ค้นหา][แจ้งเตือน][🐾 สัตว์เลี้ยง] [👤 โปรไฟล์]
ทุก variation ใช้ tab set เดียวกัน — ต่างได้แค่ visual treatment (size, elevation, icon style)

# Screens in scope

## Screen 1: `/pets`
Purpose: จัดการ pet profile (1 บ้านมักมีหลายตัว) — list view + quick access ไป detail
Primary action: เพิ่มสัตว์เลี้ยงตัวใหม่
Secondary actions: ดู/แก้ไข profile, ดู vaccine status, set reminder
Sample data (ไทยจริง ห้าม lorem):
  - มะลิ — ชิวาวาผสม , สีดำ, เพศเมีย,เกิดวันที่ 2 มีนาคม 2562, อายุ 4 ปี 2 เดือน, 3.2 kg, ลักษณะเฉพาะ ขาสั้น ใส่ถุงเท้าสีขาว, วัคซีนครบ, ครบกำหนด booster 15 ธ.ค. 2568
  - เทา — แมวไทย , สีขาว, เพศผู้, เกิดวันที่ 2 มีนาคม 2564, อายุ 2 ปี, 4.5 kg, ทำหมันแล้ว,ลักษณะเฉพาะ หูพับ หัวเล็ก พุงเลยดูใหญ่, วัคซีน FVRCP ถึง 3 มี.ค. 2569
Pet's gallery: สัตว์แต่ละตัวสามารถ upload รูปไว้ได้สูงสุด 10 รูป โดยเจ้าของสามารถเลือกอย่างน้อย 3 สูงสุด 5 ไว้สำหรับกรณีแจ้งสัตว์หายจะใช้รูปเหล่านั้นสำหรับการประกาศตามหาทันที

## Screen 2: `/post/lost`
Purpose: moment panic — สัตว์เลี้ยงหายเพิ่งรู้ ต้องส่ง alert เร็วที่สุดไปยังคนใกล้เคียง
Primary action: โพสต์ประกาศ (ต้องกดได้จบในไม่กี่ tap)
Secondary actions: เลือกรูปเพิ่ม, ตั้งระยะ broadcast, ใส่รางวัล
Sample data filled state:
  - เลือก pet จาก pre-registered: "มะลิ (ดึงข้อมูลอัตโนมัติ)"
  - รูปภาพจาก gallery 3-5 รูป
  - สถานที่เห็นล่าสุด: "ซอยลาดพร้าว 71 หน้าร้าน 7-Eleven" + map pin
  - วันเวลา: "19 ต.ค. 2568 เวลา 18:45"
  - รางวัล: "฿2,000"
  - ช่องทางติดต่อ: "LINE: @malim_mom" "โทรศัพท์: 088 888 8888"
  - โน้ตเพิ่มเติม: "ใส่ปลอกคอสีแดง มีป้ายชื่อ กลัวมอเตอร์ไซค์ อย่าไล่"
  - broadcast radius: 3 km

# Variation requirements
5 variations แต่ละ variation = 1 cohesive concept ภายในตัวเอง
ทั้ง 5 ต้องต่างกันใน 4 มิติ:
  1. Layout structure
  2. Visual style / mood
  3. Information hierarchy
  4. Interaction pattern (เล่าผ่าน static state)

เลือก 5 direction จากนี้ (หรือเสนอใหม่พร้อม justification):
  A. Minimal editorial — whitespace เยอะ typography-led
  B. Dashboard-dense — data-forward KPI ชัด
  C. Timeline / feed — chat-like เรียงตามเวลา
  D. Illustrative playful — มี mascot icon custom สีสด
  E. iOS-native mimic — รู้สึกเหมือน native app ใน LIFF
  F. Bento grid — modular blocks scannable
  G. Card-stack — one-thing-at-a-time

# Design system ต่อ variation
ยังไม่มี design system เดิม → แต่ละ variation propose tokens ของตัวเอง:
  - Color: primary / secondary / semantic (success warning danger) / neutrals
  - Typography: ต้อง support ไทย (Noto Sans Thai / IBM Plex Sans Thai / Sarabun)
  - Spacing scale (4/8/12/16/24/32...)
  - Radius + elevation
ใส่เป็น CSS custom properties ที่ `:root` เพื่อให้ system เห็นชัด

# Reference: Foundy
ดู https://foundy.tigerfoundationtech.co.th/ เพื่อเข้าใจ market context
ห้ามลอก: color palette, hero layout, specific wording, iconography
เรียนรู้จาก: map-based discovery pattern, reward badge treatment
ต่างจาก Foundy ชัดๆ: Pawrent = health OS + lost&found พร้อม pre-registered profile, ไม่ใช่ lost-only ad-hoc

# Deliverables (สร้างใน `/ROADMAP/New-design/` — `mkdir -p` ถ้ายังไม่มี folder)
1. `variation-01.html` … `variation-05.html` — standalone
   - Tailwind CDN + Google Fonts CDN เท่านั้น
   - Mobile-first viewport 390px responsive ถึง 768px
   - Comment block ที่หัวไฟล์: design thesis 2–3 ประโยค + justification อ้างอิง framework (NNG/Material/HIG) + token summary
   - แต่ละไฟล์ render 2 screen stacked vertically คั่นด้วย section label `<!-- Screen: /pets -->` และ `<!-- Screen: /post/lost -->`
   - Filled state เท่านั้น ไม่ต้องทำ empty/loading/error
2. `index.html` — comparison grid ทั้ง 5 แบบใน iframe พร้อม label ชื่อ concept + thesis สั้น

# Constraints
- WCAG AA contrast ทุก text
- Touch target ≥ 44×44 px
- ห้าม JS ซับซ้อน (Tailwind CDN เท่านั้น ไม่ต้องมี interactivity)
- Safe สำหรับ LIFF iframe (ไม่มี `window.top`, ไม่มี external redirect)
- ข้อมูลตัวอย่างสมจริง (ชื่อไทย, วันที่ พ.ศ., ราคาบาท)
- **ห้ามใช้ personal opinion** — ทุก design decision ต้อง cite หนึ่งในนี้:
  - UX framework (NNG heuristics, Material Design, Apple HIG, WCAG)
  - Thai pet-parent / LINE user behavior pattern
- ห้ามลอก Foundy (ดู section reference ด้านบน)

# Output plan (ทำตามลำดับเคร่งครัด)
1. (ถ้า persona ยังไม่ lock) propose 2 personas → STOP รอ confirm
2. สรุป 5 concepts (ชื่อ + 1 บรรทัด thesis + 1 บรรทัด framework citation) → STOP รอ confirm
3. หลัง confirm: ทำทีละไฟล์ ส่งทีละแบบให้ review ก่อนทำอันถัดไป
4. จบด้วย `index.html` comparison grid