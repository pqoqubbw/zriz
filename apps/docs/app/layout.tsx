import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { cn } from "@/lib/cn";

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

export const metadata: Metadata = {
  description:
    "zriz is an image cropper for react with a straighten dial, like the crop tool in ios photos.",
  metadataBase: new URL("https://zriz.dev"),
  title: { default: "zriz", template: "%s | zriz" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fdfdfc",
};

const Layout = ({ children }: { children: React.ReactNode }) => (
  <html className={cn(inter.variable, paperMono.variable)} lang="en">
    <body>{children}</body>
  </html>
);

export default Layout;
