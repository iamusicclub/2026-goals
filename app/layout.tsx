import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "2026 Goals",
  description: "Daily goal tracking for 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}