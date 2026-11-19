"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Preview UI only. Caller supplies the real opening control for reliable focus return. */
export function DemoModal({ title, onClose, trigger, fallbackId, children }: { title: string; onClose: () => void; trigger: HTMLElement | null; fallbackId?: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose); latestClose.current = onClose;
  const origin = useRef(trigger);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); latestClose.current(); return; }
      if (event.key !== "Tab") return;
      const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
      if (!nodes.length) { event.preventDefault(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); const target = origin.current?.isConnected ? origin.current : fallbackId ? document.getElementById(fallbackId) : null; target?.focus(); };
  }, [fallbackId]);
  useEffect(() => { root.current?.querySelector<HTMLButtonElement>('[data-close-modal]')?.focus(); }, [title]);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-star-900/50 p-3 sm:p-6"><div ref={root} role="dialog" aria-modal="true" aria-labelledby="demo-modal-title" className="flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"><div className="flex items-start justify-between gap-3 border-b border-[#e6ede6] px-5 py-4 sm:px-6"><div><p className="text-[10px] font-extrabold uppercase tracking-wide text-star-700">Synthetic demo only</p><h2 id="demo-modal-title" className="mt-1 text-xl font-extrabold text-star-900">{title}</h2></div><button type="button" data-close-modal onClick={onClose} aria-label={`Close ${title}`} className="rounded p-2 text-[#56705d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={20}/></button></div><div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6">{children}</div></div></div>;
}
export const demoButton = "rounded-md px-4 py-2.5 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700";
