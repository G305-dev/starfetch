import { Download, Eye } from "lucide-react";
import { corporateDocuments } from "./corporate-dashboard-data";

export function CorporateDocumentsCard() {
  return (
    <section id="documents" className="scroll-mt-24 rounded-lg border border-star-200 bg-white p-5" aria-labelledby="corporate-documents-heading">
      <h2 id="corporate-documents-heading" className="text-lg font-extrabold text-star-900">Documents &amp; Requests</h2>
      <div className="mt-4 divide-y divide-star-100 rounded-md border border-star-200">{corporateDocuments.map(({ label, icon: Icon }, index) => <button key={label} type="button" title={`${label} is unavailable in this dashboard mockup`} className="flex min-h-13 w-full items-center gap-3 px-3.5 text-left text-sm font-semibold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700"><Icon size={19} aria-hidden="true" /><span className="flex-1">{label}</span>{index === 0 ? <Download size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>)}</div>
    </section>
  );
}
