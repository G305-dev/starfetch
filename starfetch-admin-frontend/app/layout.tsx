import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({ src: "../public/fonts/Manrope-Variable.ttf", weight: "400 800", display: "swap", variable: "--font-manrope" });
export const metadata: Metadata = { title: "Starfetch Admin Portal Preview", description: "Standalone frontend preview of the Starfetch admin portal." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={manrope.variable}><body>{children}</body></html>;
}
