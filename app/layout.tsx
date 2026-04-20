import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { LiffProvider } from "@/components/liff-provider";
import { LocationProvider } from "@/components/location-provider";
import { NavigationShell } from "@/components/navigation-shell";
import { ToastProvider } from "@/components/ui/toast";
import { DebugConsole } from "@/components/debug-console";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pawrent | Pet OS Dashboard",
  description: "Your all-in-one Pet Passport & Safety Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF8263",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} font-sans antialiased`}>
        <DebugConsole />
        <ToastProvider>
          <LiffProvider>
            <LocationProvider>
              <NavigationShell>{children}</NavigationShell>
            </LocationProvider>
          </LiffProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
