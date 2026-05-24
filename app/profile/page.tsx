"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/liff-provider";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/image-cropper";
import { getPets, getProfile, uploadProfileAvatar } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { imageFileSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { Pet, Profile } from "@/lib/types";
import {
  Bell,
  ChevronRight,
  Camera,
  X,
  Loader2,
  LogOut,
  Pencil,
  Shield,
  Crown,
  Download,
  FileText,
  Trash2,
  Globe,
  Palette,
  Volume2,
  Info,
  MessageSquare,
  BookOpen,
  Bug,
  Mail,
  Phone,
} from "lucide-react";

const APP_VERSION = "0.4.1";

function formatJoinDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function BubbleCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-border bg-card shadow-soft overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function ProfileContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarImageToCrop, setAvatarImageToCrop] = useState<string | null>(null);

  const [notifyRadiusKm, setNotifyRadiusKm] = useState(3);
  const [notifyHealth, setNotifyHealth] = useState(true);
  const [notifyCommunity, setNotifyCommunity] = useState(true);

  const fetchPets = async () => {
    if (!user) return;
    const { data } = await getPets(user.id);
    setPets(data || []);
  };

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await getProfile(user.id);
    if (data) {
      setProfile(data);
      setEditName(data.full_name || "");
    }
  };

  useEffect(() => {
    async function init() {
      await Promise.all([fetchPets(), fetchProfile()]);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile?.full_name || user?.line_display_name || "ชาวป๊อปส์";
  const email = user?.email || "";
  const joinLabel = formatJoinDate(profile?.created_at);
  const petCount = pets.length;
  const petLimit = 5;
  const postCount = 0;
  const postLimit = 50;

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-surface-alt/40">
      {/* === Privacy Modal === */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="ปิด"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPrivacy(false)}
          />
          <div className="relative bg-card rounded-[24px] shadow-xl border border-border max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowPrivacy(false)}
              aria-label="ปิด"
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-alt"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-info-bg flex items-center justify-center">
                <Shield className="w-5 h-5 text-info" />
              </div>
              <h2 className="text-lg font-extrabold text-text-main">ความเป็นส่วนตัว</h2>
            </div>

            <div className="space-y-4 text-sm text-text-muted leading-relaxed">
              <section>
                <h3 className="font-bold text-text-main mb-1">PDPA Privacy Notice</h3>
                <p>
                  Pawrent เคารพความเป็นส่วนตัวของคุณ และปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
                  (PDPA) พ.ศ. 2562 อย่างเคร่งครัด
                </p>
              </section>
              <section>
                <h3 className="font-bold text-text-main mb-1">ข้อมูลที่เก็บ</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ข้อมูลบัญชี (อีเมล ชื่อ)</li>
                  <li>ข้อมูลสัตว์เลี้ยง (ชื่อ สายพันธุ์ รูป)</li>
                  <li>ประวัติสุขภาพ (วัคซีน บันทึกแพทย์)</li>
                  <li>ตำแหน่งที่ตั้ง (สำหรับประกาศสัตว์หายเท่านั้น)</li>
                </ul>
              </section>
              <section>
                <h3 className="font-bold text-text-main mb-1">สิทธิของคุณ</h3>
                <p>
                  คุณมีสิทธิเข้าถึง แก้ไข ลบ หรือถ่ายโอนข้อมูลส่วนบุคคลได้ทุกเมื่อ ติดต่อ
                  privacy@pawrent.app
                </p>
              </section>
            </div>

            <Button
              onClick={() => setShowPrivacy(false)}
              className="w-full mt-6 h-12 rounded-full bg-primary-gradient text-white font-bold shadow-primary"
            >
              เข้าใจแล้ว
            </Button>
          </div>
        </div>
      )}

      {/* === Edit Profile Modal === */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="ปิด"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowEditProfile(false);
              setEditAvatarFile(null);
              setEditAvatarPreview(null);
            }}
          />
          <div className="relative bg-card rounded-[24px] shadow-xl border border-border max-w-md w-full p-6">
            <button
              type="button"
              onClick={() => {
                setShowEditProfile(false);
                setEditAvatarFile(null);
                setEditAvatarPreview(null);
              }}
              aria-label="ปิด"
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-alt"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-extrabold text-text-main mb-6">แก้ไขโปรไฟล์</h2>

            {showAvatarCropper && avatarImageToCrop && (
              <ImageCropper
                imageSrc={avatarImageToCrop}
                onCropComplete={(croppedBlob) => {
                  const file = new File([croppedBlob], "avatar.jpg", {
                    type: "image/jpeg",
                  });
                  setEditAvatarFile(file);
                  setEditAvatarPreview(URL.createObjectURL(croppedBlob));
                  setShowAvatarCropper(false);
                  setAvatarImageToCrop(null);
                }}
                onCancel={() => {
                  setShowAvatarCropper(false);
                  setAvatarImageToCrop(null);
                }}
                aspectRatio={1}
                cropShape="rect"
              />
            )}

            <div className="flex justify-center mb-2">
              <label className="cursor-pointer relative">
                <div className="w-24 h-24 rounded-full bg-pops-gradient p-[3px] shadow-glow">
                  <div className="w-full h-full rounded-full bg-surface-alt flex items-center justify-center overflow-hidden">
                    {editAvatarPreview || profile?.avatar_url ? (
                      <Image
                        src={editAvatarPreview || profile?.avatar_url || ""}
                        alt="Avatar"
                        width={88}
                        height={88}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-8 h-8 text-text-muted" />
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-primary">
                  <Camera className="w-4 h-4" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const imageUrl = URL.createObjectURL(file);
                      setAvatarImageToCrop(imageUrl);
                      setShowAvatarCropper(true);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-center text-text-muted mb-4">แตะเพื่อเปลี่ยนรูป</p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-text-main mb-2">ชื่อที่แสดง</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="ชื่อของคุณ"
                className="w-full p-3 rounded-full border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditProfile(false);
                  setEditAvatarFile(null);
                  setEditAvatarPreview(null);
                }}
                className="flex-1 h-12 rounded-full"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={async () => {
                  if (!user) return;
                  setSavingProfile(true);
                  try {
                    let avatarUrl = profile?.avatar_url || null;
                    if (editAvatarFile) {
                      const fileResult = imageFileSchema.safeParse({
                        size: editAvatarFile.size,
                        type: editAvatarFile.type,
                      });
                      if (!fileResult.success) {
                        alert(fileResult.error.issues[0].message);
                        setSavingProfile(false);
                        return;
                      }
                      const { data: uploadedUrl, error: uploadError } = await uploadProfileAvatar(
                        editAvatarFile,
                        user.id
                      );
                      if (!uploadError && uploadedUrl) {
                        avatarUrl = uploadedUrl;
                      }
                    }
                    await apiFetch("/api/profile", {
                      method: "PUT",
                      body: JSON.stringify({
                        full_name: editName || null,
                        avatar_url: avatarUrl,
                      }),
                    });
                    await fetchProfile();
                    setShowEditProfile(false);
                    setEditAvatarFile(null);
                    setEditAvatarPreview(null);
                  } catch (err) {
                    console.error("Failed to update profile:", err);
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                disabled={savingProfile}
                className="flex-1 h-12 rounded-full bg-primary-gradient text-white shadow-primary"
              >
                {savingProfile ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {/* Title strip */}
        <div className="flex items-center justify-between pt-1 pb-2">
          <div>
            <p className="text-lg font-extrabold text-text-main leading-tight">โปรไฟล์ของฉัน</p>
            <p className="text-[11px] text-text-muted">จัดการบัญชี · แพ็คเกจ · ความเป็นส่วนตัว</p>
          </div>
          <Link
            href="/notifications"
            aria-label="การแจ้งเตือน"
            className="w-11 h-11 rounded-full bg-surface shadow-soft flex items-center justify-center"
          >
            <Bell className="w-5 h-5 text-text-subtle" />
          </Link>
        </div>

        {/* (2) Owner Hero Card */}
        <BubbleCard className="shadow-owner">
          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full bg-pops-gradient p-[3px] shadow-glow">
                  <div className="w-full h-full rounded-full bg-surface flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={displayName}
                        width={74}
                        height={74}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl" aria-hidden>
                        👤
                      </span>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-surface flex items-center justify-center shadow-soft">
                  <span className="text-[10px]" aria-hidden>
                    ✓
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-base font-extrabold text-text-main leading-tight truncate">
                  {displayName}
                </p>
                {user?.line_display_name && user.line_display_name !== displayName && (
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">
                    LINE: {user.line_display_name}
                  </p>
                )}
                {email && <p className="text-[11px] text-text-muted truncate">{email}</p>}
                {joinLabel && (
                  <p className="text-[10px] text-text-muted mt-1">สมาชิกตั้งแต่ {joinLabel}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-[16px] bg-surface-alt p-2.5 text-center">
                <p className="text-lg mb-0.5" aria-hidden>
                  🐾
                </p>
                <p className="text-sm font-extrabold text-text-main">{petCount}</p>
                <p className="text-[10px] text-text-muted">สัตว์เลี้ยง</p>
              </div>
              <div className="rounded-[16px] bg-surface-alt p-2.5 text-center">
                <p className="text-lg mb-0.5" aria-hidden>
                  📄
                </p>
                <p className="text-sm font-extrabold text-text-main">{postCount}</p>
                <p className="text-[10px] text-text-muted">โพสต์</p>
              </div>
              <div className="rounded-[16px] bg-surface-alt p-2.5 text-center">
                <p className="text-lg mb-0.5" aria-hidden>
                  ❤️
                </p>
                <p className="text-sm font-extrabold text-text-main">0</p>
                <p className="text-[10px] text-text-muted">ช่วยเหลือ</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEditProfile(true)}
              className="w-full h-11 rounded-full border-2 border-border bg-surface text-xs font-bold text-text-main flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Pencil className="w-3.5 h-3.5" />
              แก้ไขโปรไฟล์
            </button>
          </div>
        </BubbleCard>

        {/* (3) Package / Subscription */}
        <BubbleCard>
          <div className="h-1 bg-primary-gradient" />
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <span className="inline-block bg-surface-alt text-text-subtle rounded-full px-2.5 py-0.5 text-[10px] font-bold mb-1.5">
                  แพ็คเกจปัจจุบัน
                </span>
                <p className="text-base font-extrabold text-text-main leading-tight">
                  POPS Family 🏠
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  สูงสุด {petLimit} ตัว · {postLimit} โพสต์/เดือน · ฟีเจอร์พื้นฐาน
                </p>
              </div>
              <span className="bg-success-bg text-success rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0">
                ฟรี
              </span>
            </div>

            <div className="space-y-2.5 mb-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-text-main">🐾 สัตว์เลี้ยง</span>
                  <span className="text-[11px] font-bold text-text-main">
                    {petCount}
                    <span className="text-text-muted font-normal">/{petLimit}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-gradient"
                    style={{ width: `${Math.min(100, (petCount / petLimit) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-text-main">📄 โพสต์เดือนนี้</span>
                  <span className="text-[11px] font-bold text-text-main">
                    {postCount}
                    <span className="text-text-muted font-normal">/{postLimit}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-gradient"
                    style={{ width: `${Math.min(100, (postCount / postLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="w-full h-12 rounded-full bg-primary-gradient text-white text-sm font-bold shadow-primary flex items-center justify-center gap-2 opacity-60"
            >
              <Crown className="w-4 h-4" />
              อัปเกรดเป็น POPS Premium — เร็วๆ นี้
            </button>
            <p className="text-[10px] text-text-muted text-center mt-2">
              AI ค้นหา + ไม่จำกัดโพสต์ + ตรวจสุขภาพรายเดือน
            </p>
          </div>
        </BubbleCard>

        {/* (4) My Pets link row */}
        <Link
          href="/pets"
          className="block bg-card rounded-[24px] shadow-soft border border-border p-3.5 flex items-center gap-3 min-h-[64px] active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center text-xl shrink-0">
            🐾
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-main">สัตว์เลี้ยงของฉัน</p>
            <p className="text-[11px] text-text-muted truncate">
              {pets.length > 0 ? pets.map((p) => p.name).join(" · ") : "ยังไม่มีน้อง"}
            </p>
          </div>
          <span className="bg-surface-alt text-text-subtle rounded-full px-2.5 py-0.5 text-[10px] font-bold">
            {pets.length} ตัว
          </span>
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </Link>

        {/* (5) Contact channels */}
        <BubbleCard>
          <div className="p-4">
            <div className="mb-3">
              <p className="text-sm font-bold text-text-main mb-0.5">📱 ช่องทางติดต่อ</p>
              <p className="text-[10px] text-text-muted">
                สำหรับโพสต์สัตว์หาย — จะแสดงตามที่คุณเลือก
              </p>
            </div>

            <div>
              {user?.line_display_name && (
                <div className="flex items-center gap-3 py-2.5 border-b border-border/60">
                  <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-text-muted">LINE</p>
                    <p className="text-xs font-bold text-text-main truncate">
                      {user.line_display_name}
                    </p>
                  </div>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-3 py-2.5">
                  <div className="w-10 h-10 rounded-full bg-info-bg flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-info" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-text-muted">Email</p>
                    <p className="text-xs font-bold text-text-main truncate">{email}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowEditProfile(true)}
                className="flex items-center gap-3 py-2.5 w-full border-t border-border/60"
              >
                <div className="w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] text-text-muted">เบอร์โทร</p>
                  <p className="text-xs font-bold text-text-muted">
                    ยังไม่ได้ตั้งค่า — แตะเพื่อเพิ่ม
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </button>
            </div>

            <div className="mt-3 p-2.5 rounded-[16px] bg-surface-alt">
              <p className="text-[10px] text-text-subtle leading-relaxed">
                ℹ️ ข้อมูลจะแสดงในโพสต์ตามที่คุณเลือกในแต่ละครั้ง
              </p>
            </div>
          </div>
        </BubbleCard>

        {/* (6) Notification settings */}
        <BubbleCard>
          <div className="p-4">
            <p className="text-sm font-bold text-text-main mb-3">🔔 การแจ้งเตือน</p>

            <div className="py-2.5 border-b border-border/60">
              <div className="mb-2">
                <p className="text-xs font-bold text-text-main">📍 สัตว์หายในรัศมี</p>
                <p className="text-[10px] text-text-muted">แจ้งเมื่อมีสัตว์หายใกล้คุณ</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 3, 5, 10].map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => setNotifyRadiusKm(km)}
                    className={cn(
                      "h-9 px-3 rounded-full text-[11px] font-bold min-w-[44px] transition-all",
                      notifyRadiusKm === km
                        ? "bg-primary-gradient text-white shadow-glow"
                        : "bg-surface-alt text-text-muted"
                    )}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>

            <ToggleRow
              icon="💉"
              title="สุขภาพสัตว์"
              subtitle="วัคซีน · ยาถ่ายพยาธิ · นัดหมอ"
              value={notifyHealth}
              onChange={setNotifyHealth}
            />
            <ToggleRow
              icon="👥"
              title="ชุมชน"
              subtitle="ข่าวสาร · โพสต์จากเพื่อน"
              value={notifyCommunity}
              onChange={setNotifyCommunity}
            />
          </div>
        </BubbleCard>

        {/* (7) Privacy & Data */}
        <BubbleCard>
          <div className="p-4">
            <div className="mb-3">
              <p className="text-sm font-bold text-text-main">🔒 ความเป็นส่วนตัว &amp; ข้อมูล</p>
              <p className="text-[10px] text-text-muted">
                ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </p>
            </div>

            <div>
              <a
                href="/api/me/data-export"
                className="w-full flex items-center gap-3 py-3 border-b border-border/60 min-h-[44px]"
              >
                <div className="w-9 h-9 rounded-full bg-info-bg flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-info" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-text-main">ดาวน์โหลดข้อมูลของฉัน</p>
                  <p className="text-[10px] text-text-muted">ส่งออกข้อมูลทั้งหมดเป็นไฟล์ JSON</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </a>
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="w-full flex items-center gap-3 py-3 border-b border-border/60 min-h-[44px]"
              >
                <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-text-subtle" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-text-main">นโยบายความเป็นส่วนตัว</p>
                  <p className="text-[10px] text-text-muted">PDPA พ.ศ. 2562</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </button>
              <button
                type="button"
                disabled
                className="w-full flex items-center gap-3 py-3 min-h-[44px] opacity-60"
              >
                <div className="w-9 h-9 rounded-full bg-danger-bg flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-danger" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-danger">ลบบัญชีและข้อมูลทั้งหมด</p>
                  <p className="text-[10px] text-text-muted">
                    ไม่สามารถกู้คืนได้ — ติดต่อ privacy@pawrent.app
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-danger" />
              </button>
            </div>
          </div>
        </BubbleCard>

        {/* (8) App settings */}
        <BubbleCard>
          <div className="p-4">
            <p className="text-sm font-bold text-text-main mb-3">⚙️ การตั้งค่าแอป</p>

            <SettingsRow
              icon={<Globe className="w-4 h-4 text-text-muted" />}
              label="ภาษา"
              value="ไทย"
              divider
            />
            <SettingsRow
              icon={<Palette className="w-4 h-4 text-text-muted" />}
              label="โหมดสี"
              value="ตามระบบ"
              divider
            />
            <SettingsRow
              icon={<Volume2 className="w-4 h-4 text-text-muted" />}
              label="เสียงแจ้งเตือน"
              value="เปิด"
              divider
            />
            <div className="flex items-center justify-between py-3 min-h-[44px]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Info className="w-4 h-4 text-text-muted" />
                <p className="text-xs font-bold text-text-main">เวอร์ชัน</p>
              </div>
              <span className="text-[11px] text-text-muted font-mono">{APP_VERSION}</span>
            </div>
          </div>
        </BubbleCard>

        {/* (9) Help */}
        <BubbleCard>
          <div className="p-4">
            <p className="text-sm font-bold text-text-main mb-3">🆘 ช่วยเหลือ</p>

            <Link
              href="/feedback"
              className="w-full flex items-center gap-3 py-3 border-b border-border/60 min-h-[44px]"
            >
              <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-text-subtle" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-text-main">ส่งความคิดเห็น</p>
                <p className="text-[10px] text-text-muted">บอกเราว่าคิดอย่างไรกับ Pawrent</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
            <button
              type="button"
              disabled
              className="w-full flex items-center gap-3 py-3 border-b border-border/60 min-h-[44px] opacity-60"
            >
              <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-text-subtle" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-text-main">คู่มือการใช้งาน</p>
                <p className="text-[10px] text-text-muted">เร็วๆ นี้</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </button>
            <Link href="/feedback" className="w-full flex items-center gap-3 py-3 min-h-[44px]">
              <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center shrink-0">
                <Bug className="w-4 h-4 text-text-subtle" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-text-main">แจ้งปัญหา</p>
                <p className="text-[10px] text-text-muted">รายงานข้อผิดพลาดหรือปัญหาการใช้งาน</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          </div>
        </BubbleCard>

        {/* (10) Sign out */}
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="w-full h-12 rounded-full border-2 border-danger bg-surface text-sm font-bold text-danger flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>

        {/* (11) Footer */}
        <div className="pt-2 pb-4 text-center space-y-0.5">
          <p className="text-[11px] font-bold text-text-muted">Pawrent · Part of POPS Family 🐾</p>
          <p className="text-[10px] text-text-muted">© 2026 POPS SaaS · Thailand</p>
          <p className="text-[10px] text-text-muted">สร้างด้วย ❤️ เพื่อเจ้าของสัตว์เลี้ยงชาวไทย</p>
        </div>
      </main>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/60 last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-xs font-bold text-text-main">
          <span className="mr-1">{icon}</span>
          {title}
        </p>
        <p className="text-[10px] text-text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={title}
        onClick={() => onChange(!value)}
        className={cn(
          "relative w-11 h-6 rounded-full border transition-colors shrink-0",
          value ? "bg-primary-gradient border-transparent" : "bg-surface-alt border-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all",
            value ? "left-5" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  divider,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 min-h-[44px]",
        divider && "border-b border-border/60"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon}
        <p className="text-xs font-bold text-text-main">{label}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-text-muted">{value}</span>
        <ChevronRight className="w-4 h-4 text-text-muted" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-pops-gradient shadow-glow flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl" aria-hidden>
              🐾
            </span>
          </div>
          <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบ…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-pops-gradient shadow-glow flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl" aria-hidden>
              🐾
            </span>
          </div>
          <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบผ่าน LINE…</p>
        </div>
      </div>
    );
  }

  return <ProfileContent />;
}

ProfilePage.displayName = "ProfilePage";
