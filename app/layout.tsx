import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { LocationProvider } from "@/components/location-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <ToastProvider>
          <AuthProvider>
            <LocationProvider>{children}</LocationProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
