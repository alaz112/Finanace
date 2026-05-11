import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance",
  description: "Piyasa takip",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-apple-bg text-apple-label min-h-screen">{children}</body>
    </html>
  );
}
