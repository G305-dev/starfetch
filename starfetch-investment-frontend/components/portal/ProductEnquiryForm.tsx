"use client";

import { type FormEvent, useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";

type ProductEnquiryFormProps = {
  productName: string;
  onClose: () => void;
};

/** A local-only product interest form. It deliberately makes no network request. */
export function ProductEnquiryForm({ productName, onClose }: ProductEnquiryFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-star-900/50 px-4 py-5 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="product-enquiry-heading"><section className="relative w-full max-w-lg rounded-2xl border border-star-200 bg-[#fffef9] p-6 shadow-[0_20px_55px_rgba(0,59,42,0.3)] sm:p-8"><button type="button" onClick={onClose} aria-label="Close product enquiry" className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-star-muted transition hover:bg-white hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><X size={20} aria-hidden="true" /></button>{submitted ? <div className="py-3 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#168348] text-white"><Check size={26} strokeWidth={3} aria-hidden="true" /></span><h2 id="product-enquiry-heading" className="mt-4 font-display text-2xl font-extrabold tracking-[-0.035em] text-star-900">Interest confirmed</h2><p className="mt-3 text-sm leading-6 text-star-muted">Thank you, {fullName}. Your interest in <strong className="text-star-900">{productName}</strong> has been recorded in this frontend preview. No details have been transmitted or stored.</p><button type="button" onClick={onClose} className="mt-6 min-h-11 rounded-lg bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Close</button></div> : <form onSubmit={submit}><span className="grid size-11 place-items-center rounded-full bg-star-50 text-star-700"><MessageSquare size={21} aria-hidden="true" /></span><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Product enquiry</p><h2 id="product-enquiry-heading" className="mt-2 pr-9 font-display text-2xl font-extrabold tracking-[-0.035em] text-star-900">Register your interest</h2><p className="mt-2 text-sm leading-6 text-star-muted">Tell us how to reach you about <strong className="text-star-900">{productName}</strong>.</p><label className="mt-6 block"><span className="mb-2 block text-sm font-extrabold text-star-900">Full name</span><input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" className="h-12 w-full rounded-lg border border-star-200 bg-white px-3.5 text-sm font-medium text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><label className="mt-5 block"><span className="mb-2 block text-sm font-extrabold text-star-900">Phone number</span><input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. +234 800 000 0000" className="h-12 w-full rounded-lg border border-star-200 bg-white px-3.5 text-sm font-medium text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><p className="mt-4 text-xs leading-5 text-star-muted">This is a frontend-only expression of interest. It does not create an investment, funding instruction, or client account.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-star-200 px-5 text-sm font-extrabold text-star-700 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Cancel</button><button type="submit" className="min-h-11 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Confirm interest</button></div></form>}</section></div>;
}
