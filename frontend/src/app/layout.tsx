import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "XAU, CHF, MRVL, AVGO anlık takip",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-brand-bg text-brand-text min-h-screen">{children}</body>
    </html>
  );
}
