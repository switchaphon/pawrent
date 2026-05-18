"use client";

export default function PetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(180deg, #FAF7F2 0%, #F5F1EA 100%)" }}
    >
      <div
        className="flex items-center justify-center rounded-full mb-4"
        style={{
          width: 64,
          height: 64,
          background: "var(--danger-bg, #FFEBEE)",
          border: "2px solid #F8D7DA",
          fontSize: 28,
        }}
      >
        🐾
      </div>
      <h2 className="text-[14px] font-extrabold text-text-main mb-1.5">
        โหลดข้อมูลน้องไม่สำเร็จ
      </h2>
      <p className="text-[11px] text-text-muted leading-relaxed max-w-[220px] mb-4">
        {error.message || "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้"}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center min-h-[44px] px-6 text-[13px] font-bold text-white rounded-full"
        style={{
          background: "linear-gradient(135deg, #FF8263, #FFA563)",
          boxShadow: "0 4px 14px rgba(255, 130, 99, 0.3)",
        }}
      >
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
