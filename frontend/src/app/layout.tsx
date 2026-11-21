import type { Metadata } from "next";
import Script from "next/script";
import { AppToaster } from "@/components/ui/app-toaster";
import { ZOOM_BOOT_SCRIPT } from "@/lib/display-zoom";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InVoyce Lite",
    template: "%s · InVoyce Lite",
  },
  description:
    "Billing, inventory, GST and accounts for growing businesses.",
  // An internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets the user's zoom on <html> before React hydrates.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script id="zoom-boot" strategy="beforeInteractive">
          {ZOOM_BOOT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full font-sans">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
