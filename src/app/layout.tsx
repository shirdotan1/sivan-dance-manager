import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SongBankProvider } from "@/components/songs/SongBankProvider";
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
        <SiteHeader />
        <SongBankProvider>
          <main id="content" className="safe-page mx-auto w-full max-w-3xl flex-1 pt-6">
            {children}
          </main>
        </SongBankProvider>
      </body>
    </html>
  );
}
