import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@zriz/react/styles.css";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  description: "Headless image cropper for React with the feel of iOS Photos.",
  metadataBase: new URL("https://zriz.dev"),
  title: { default: "zriz", template: "%s | zriz" },
};

const Layout = ({ children }: { children: React.ReactNode }) => (
  <html className={`${sans.variable} ${mono.variable}`} lang="en">
    <body>{children}</body>
  </html>
);

export default Layout;
