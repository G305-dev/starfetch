import type { Metadata } from "next";
import { AdminLoginBrandPanel } from "@/components/admin/login/AdminLoginBrandPanel";
import { AdminLoginForm } from "@/components/admin/login/AdminLoginForm";
import { AdminLoginHeader } from "@/components/admin/login/AdminLoginHeader";

export const metadata: Metadata = {
  title: "Admin Sign In | Starfetch Investment Limited",
  description: "Frontend preview of the Starfetch internal admin sign-in page.",
};

export default function AdminLoginPage() {
  return <main className="min-h-screen bg-[#f1f6f2] text-star-900"><AdminLoginHeader/><div className="grid min-h-[calc(100vh-68px)] md:grid-cols-[minmax(0,43fr)_minmax(0,57fr)] lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"><AdminLoginBrandPanel/><section aria-label="Admin sign-in" className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:px-12"><AdminLoginForm/></section></div></main>;
}
