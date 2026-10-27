import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Log In | Starfetch Investor Portal",
  description: "Log in to the Starfetch Investor Portal.",
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <SignInForm />
      <p className="mx-auto mt-6 max-w-[35rem] px-2 text-center text-[0.68rem] leading-5 text-star-muted sm:px-5">
        Starfetch Investment Limited is registered with the Securities and Exchange Commission, Nigeria as a Fund/Portfolio Manager. RC 7402697.
      </p>
    </AuthLayout>
  );
}
