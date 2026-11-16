import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui";

export function AdminLoginHeader() {
  return <header className="relative z-10 flex min-h-[68px] items-center justify-between gap-3 border-b border-[#e8eee8] bg-white px-4 py-3 sm:px-8 lg:px-10"><div className="flex min-w-0 items-center gap-3 sm:gap-5"><Logo href="/admin/login"/><span aria-hidden="true" className="h-8 w-px bg-[#d7e0d8]"/><span className="whitespace-nowrap text-xs font-extrabold text-[#20392b] sm:text-sm">Admin Portal</span></div><span className="hidden items-center gap-2 rounded-lg bg-[#edf8df] px-3 py-2 text-xs font-bold text-[#16452a] sm:inline-flex"><ShieldCheck size={18} aria-hidden="true"/>Internal Admin Portal</span></header>;
}
