import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader, SiteHeaderFallback } from "@/components/SiteHeader";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | השיעורים של סיון",
    default: "השיעורים של סיון",
  },
  description: "ניהול שיעורי ריקוד: קבוצות, משתתפות, פרויקטים, שירים ותשלומים",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw edge to edge so env(safe-area-inset-*) is reported on notched phones;
  // the header and page edges pad themselves with those insets (globals.css).
  viewportFit: "cover",
  // <meta name="color-scheme"> so the browser paints the right canvas before CSS loads.
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main id="content" className="safe-page mx-auto w-full max-w-3xl flex-1 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
