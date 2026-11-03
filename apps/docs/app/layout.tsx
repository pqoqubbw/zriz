import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./globals.css";
import { cn } from "@/lib/cn";
import { SITE_DESCRIPTION, SITE_ORIGIN } from "@/lib/site";

type RootLayoutProps = {
  children: ReactNode;
};

const inter = localFont({
  display: "swap",
  src: "./fonts/inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

const paperMono = localFont({
  display: "swap",
  src: "./fonts/paper-mono.woff2",
  variable: "--font-paper-mono",
  weight: "100 800",
});

const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "zriz", template: "%s | zriz" },
};

const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fdfdfc",
};

const RootLayout = ({ children }: RootLayoutProps) => (
  <html className={cn(inter.variable, paperMono.variable)} lang="en">
    <body>{children}</body>
  </html>
);

export { metadata, viewport };
export default RootLayout;
