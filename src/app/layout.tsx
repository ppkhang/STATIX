import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import ConsentBanner from "@/components/ConsentBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "STATIX",
  description: "Four products. One system. Drop 001, numbered run.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- fonts load from Google, as on the original landing page */}
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;900&family=Permanent+Marker&family=Tektur:wght@900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <NextIntlClientProvider>
          {children}
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
