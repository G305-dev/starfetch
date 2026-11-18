import { AdminSectionCard, DataState } from "./AdminDataStates";

/** Presentation only: no record or API contract has been approved. */
export function UnavailableDetails({ title, description }: { title: string; description: string }) {
  return <AdminSectionCard className="p-4"><h2 className="text-[15px] font-extrabold">{title}</h2><p className="mt-1 text-xs text-[#738078]">{description}</p><DataState state="unavailable" title={`${title} unavailable`}/></AdminSectionCard>;
}
