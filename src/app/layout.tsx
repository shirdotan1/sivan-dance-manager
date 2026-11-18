import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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
  description: "ניהול שיעורי ריקוד: תלמידות, נוכחות, שירים ותשלומים",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main id="content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
