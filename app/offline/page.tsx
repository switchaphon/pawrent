"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-bg-start to-bg-end p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F06FA8] via-[#FF9285] to-[#FFCB6B] p-[3px] shadow-glow mb-6">
        <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-text-muted" />
        </div>
      </div>
      <h1 className="text-xl font-extrabold text-text-main mb-2">คุณออฟไลน์อยู่</h1>
      <p className="text-sm text-text-muted mb-6">
        กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง
      </p>
      <button
        onClick={() => window.location.reload()}
        className="h-11 px-6 bg-gradient-to-br from-primary to-primary-light text-white text-sm font-bold rounded-full shadow-primary active:scale-95 transition-transform"
      >
        ลองอีกครั้ง
      </button>
      <p className="mt-8 text-[10px] text-text-muted">Pawrent · Part of POPS Family 🐾</p>
    </div>
  );
}
