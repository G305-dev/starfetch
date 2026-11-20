"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { validateAdminLogin, type AdminLoginErrors } from "./admin-login-validation";

export function AdminLoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errors,setErrors] = useState<AdminLoginErrors>({});
  const [visible,setVisible] = useState(false);
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState<"navigation-error" | "forgot" | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || timerRef.current) return;
    const next = validateAdminLogin(emailRef.current?.value ?? "", passwordRef.current?.value ?? "");
    setErrors(next); setMessage(null);
    if (next.email || next.password) { (next.email ? emailRef.current : passwordRef.current)?.focus(); return; }
    // Development preview only: the dashboard is already unprotected. No credentials
    // are authenticated, transmitted, or saved, and no session is created.
    setLoading(true);
    timerRef.current = setTimeout(() => {
      if (passwordRef.current) passwordRef.current.value = "";
      if (emailRef.current) emailRef.current.value = "";
      timerRef.current = null;
      setVisible(false);
      try {
        router.push("/admin/dashboard");
      } catch {
        setLoading(false);
        setMessage("navigation-error");
      }
    }, 800);
  }
  const input = "h-12 w-full rounded-lg border bg-white pl-11 pr-11 text-sm text-[#183326] outline-none transition placeholder:text-[#9aa59d] focus:border-star-700 focus:ring-2 focus:ring-star-700/20 disabled:cursor-wait disabled:opacity-70";
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700";
  return <div className="w-full max-w-[565px] rounded-[22px] border border-[#e8eee8] bg-white px-5 py-7 shadow-[0_12px_35px_rgba(20,57,34,0.08)] sm:px-10 sm:py-8"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e9f8d3] text-[#07522c]"><LockKeyhole size={27} aria-hidden="true"/></span><h1 className="mt-4 text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold leading-tight tracking-[-.045em] text-[#0c3825]">Admin Sign In</h1><p className="mx-auto mt-2 max-w-[26rem] text-sm leading-6 text-[#6c7770]">Sign in to manage investors, KYC, transactions, portfolios, and reports.</p></div><div className="mt-5 flex items-start gap-2 rounded-lg border border-[#dcebd2] bg-[#f5faef] px-3 py-2.5 text-[11px] leading-5 text-[#355a3d]"><ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true"/><p><strong>Development preview:</strong> Any valid email and non-empty password open the mock dashboard. No authentication occurs; admin pages are unprotected. Do not enter real credentials.</p></div><form noValidate autoComplete="off" onSubmit={submit} className="mt-5"><div><label htmlFor="admin-work-email" className="block text-xs font-extrabold text-[#21372a]">Work Email</label><div className="relative mt-2"><Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7d8d82]" aria-hidden="true"/><input id="admin-work-email" name="email" type="email" ref={emailRef} required autoComplete="off" disabled={loading} placeholder="Enter your work email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "admin-email-error" : undefined} onChange={() => { setErrors(current => ({...current,email:undefined})); setMessage(null); }} className={`${input} ${errors.email ? "border-red-500" : "border-[#d8e1da]"}`}/></div>{errors.email && <p id="admin-email-error" className="mt-1.5 text-xs font-semibold text-red-700">{errors.email}</p>}</div><div className="mt-4"><label htmlFor="admin-password" className="block text-xs font-extrabold text-[#21372a]">Password</label><div className="relative mt-2"><LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7d8d82]" aria-hidden="true"/><input id="admin-password" name="password" type={visible ? "text" : "password"} ref={passwordRef} required autoComplete="off" disabled={loading} placeholder="Enter your password" aria-invalid={!!errors.password} aria-describedby={errors.password ? "admin-password-error" : undefined} onChange={() => { setErrors(current => ({...current,password:undefined})); setMessage(null); }} className={`${input} ${errors.password ? "border-red-500" : "border-[#d8e1da]"}`}/><button type="button" onClick={() => setVisible(current => !current)} disabled={loading} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className={`absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[#697a6f] hover:bg-[#f0f6ef] disabled:opacity-50 ${focus}`}>{visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}</button></div>{errors.password && <p id="admin-password-error" className="mt-1.5 text-xs font-semibold text-red-700">{errors.password}</p>}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#344c3b]"><input type="checkbox" name="remember" disabled={loading} className="h-4 w-4 rounded border-[#7da48a] accent-[#075038] focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"/>Remember me</label><button type="button" onClick={() => setMessage("forgot")} disabled={loading} className={`rounded text-xs font-bold text-[#176e32] underline underline-offset-2 ${focus}`}>Forgot password?</button></div><p className="mt-2 text-[10px] text-[#7b8b7e]">Remember me is a preview control and does not save a session.</p>{message && <p role="alert" className="mt-3 rounded-md border border-[#ead6d3] bg-[#fff6f5] px-3 py-2 text-xs leading-5 text-[#9f3830]">{message === "navigation-error" ? "We could not open the preview. Please try again." : "Password reset is not available in this preview."}</p>}<button type="submit" disabled={loading} aria-busy={loading} className={`mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#004b2c] text-sm font-extrabold text-white hover:bg-[#00603a] disabled:cursor-wait disabled:opacity-75 ${focus}`}>{loading ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true"/>Signing in...</> : <>Sign In <ArrowRight size={18} aria-hidden="true"/></>}</button></form><div className="mt-6 flex items-center justify-center gap-2 border-t border-[#edf1ed] pt-5 text-xs text-[#819086]"><LockKeyhole size={15} aria-hidden="true"/>Authorized personnel only.</div></div>;
}
