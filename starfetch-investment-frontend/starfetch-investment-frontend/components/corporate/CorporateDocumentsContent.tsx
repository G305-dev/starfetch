"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  EllipsisVertical,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { CorporateDocumentTabs } from "./CorporateDocumentTabs";
import {
  corporateDocumentCategories,
  corporateDocumentVerification,
  corporateDocumentsByCategory,
  documentGuidelines,
  documentStatusFilters,
  requiredCompanyDocuments,
  type CorporateDocumentRecord,
  type CorporateDocumentStatus,
  type DocumentCategoryId,
} from "./corporate-documents-data";

type Notice = { id: string; text: string } | null;

function StatusBadge({ status }: { status: CorporateDocumentStatus }) {
  const styles: Record<CorporateDocumentStatus, string> = {
    Verified: "bg-[#e1f7e7] text-[#16743d]",
    Uploaded: "bg-[#e3f1ff] text-[#1663a8]",
    "Pending Review": "bg-[#e5f3ff] text-[#176db5]",
    "Not Uploaded": "bg-[#eff2f3] text-[#62717b]",
    Required: "bg-[#fff4d8] text-[#976800]",
    "Requested by Compliance": "bg-[#fff1e5] text-[#a95600]",
  };
  const icon = status === "Verified" ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : status === "Pending Review" ? <span className="size-2 rounded-full bg-current" aria-hidden="true" /> : status === "Not Uploaded" ? <span className="size-2 rounded-full bg-current/70" aria-hidden="true" /> : <Info size={12} aria-hidden="true" />;
  return <span className={`inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${styles[status]}`}>{icon}{status}</span>;
}

function FileIcon({ type }: { type: CorporateDocumentRecord["fileType"] }) {
  const palette: Record<CorporateDocumentRecord["fileType"], string> = { PDF: "bg-[#fce5e4] text-[#e44235]", JPG: "bg-[#e4f5ea] text-[#168348]", PNG: "bg-[#e4f5ea] text-[#168348]", DOC: "bg-[#e4f1fb] text-[#1474b8]" };
  const Icon = type === "JPG" || type === "PNG" ? FileImage : FileText;
  return <span className={`flex size-8 shrink-0 items-center justify-center rounded text-[9px] font-black ${palette[type]}`}><Icon size={16} aria-hidden="true" /><span className="sr-only">{type} file</span></span>;
}

function ButtonIcon({ label, onClick, children, disabled = false }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-45">{children}</button>;
}

function UploadControl({ documentName, onUpload, compact = false }: { documentName?: string; onUpload: (file: File | undefined, documentName?: string) => void; compact?: boolean }) {
  const inputId = `document-upload-${documentName?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "new"}`;
  return <label htmlFor={inputId} className={compact ? "grid size-8 cursor-pointer place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-within:ring-2 focus-within:ring-star-700" : "inline-flex cursor-pointer items-center gap-2 rounded-md bg-star-700 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-within:ring-2 focus-within:ring-star-700 focus-within:ring-offset-2"} title={documentName ? `Upload or replace ${documentName}` : "Choose a document to upload"}><Upload size={compact ? 17 : 16} aria-hidden="true" /><span className={compact ? "sr-only" : ""}>{documentName ? "Upload / replace" : "Click to browse"}</span><input id={inputId} className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => onUpload(event.target.files?.[0], documentName)} /></label>;
}

function UploadPanel({ onUpload }: { onUpload: (file: File | undefined) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);
  function handleDrop(event: React.DragEvent<HTMLLabelElement>) { event.preventDefault(); setIsDragOver(false); onUpload(event.dataTransfer.files?.[0]); }
  return <label onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop} className={`flex min-h-[185px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-8 text-center transition focus-within:ring-2 focus-within:ring-star-700 ${isDragOver ? "border-star-700 bg-star-100" : "border-star-300 bg-[#fcfdfa] hover:border-star-700 hover:bg-star-50"}`}><span className="flex size-14 items-center justify-center rounded-full bg-[#daf1df] text-[#168348]"><Upload size={28} strokeWidth={2.3} aria-hidden="true" /></span><span className="mt-3 text-base font-extrabold text-star-900">Upload a document</span><span className="mt-1 text-sm text-star-muted">Drag and drop your file here, or <span className="font-extrabold text-[#168348]">click to browse</span></span><span className="mt-2 text-xs text-star-muted">Supported formats: PDF, JPG, PNG <span className="hidden sm:inline">(Max 10MB)</span></span><input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => onUpload(event.target.files?.[0])} /></label>;
}

function DocumentTableSkeleton() { return <div className="space-y-3 p-5" aria-label="Loading documents"><span className="sr-only">Loading documents</span>{[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-md bg-star-50" />)}</div>; }

function DocumentsDesktopTable({ documents, notice, onNotice, onUpload }: { documents: CorporateDocumentRecord[]; notice: Notice; onNotice: (notice: Notice) => void; onUpload: (file: File | undefined, name?: string) => void }) {
  const [openMore, setOpenMore] = useState<string | null>(null);
  if (!documents.length) return <EmptyState />;
  return <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-star-200 bg-[#f7f9f8] text-xs font-extrabold text-star-700"><th className="px-5 py-3.5">Document Name</th><th className="px-5 py-3.5">Description</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Date Uploaded</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-star-100">{documents.map((document) => <tr key={document.id} className="align-middle text-sm"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><FileIcon type={document.fileType} /><span className="font-extrabold text-star-900">{document.name}</span></div></td><td className="max-w-[220px] px-5 py-3.5 text-xs leading-5 text-star-muted">{document.description}</td><td className="px-5 py-3.5"><StatusBadge status={document.status} /></td><td className="whitespace-nowrap px-5 py-3.5 text-xs text-star-muted">{document.uploadedAt}</td><td className="px-5 py-3.5"><div className="flex items-center justify-end"><ButtonIcon label={`View ${document.name}`} onClick={() => onNotice({ id: document.id, text: `Viewing ${document.name} is unavailable in this frontend preview.` })} disabled={document.status === "Not Uploaded" || document.status === "Required" || document.status === "Requested by Compliance"}><Eye size={17} aria-hidden="true" /></ButtonIcon><ButtonIcon label={`Download ${document.name}`} onClick={() => onNotice({ id: document.id, text: `Download for ${document.name} is unavailable in this frontend preview.` })} disabled={document.status === "Not Uploaded" || document.status === "Required" || document.status === "Requested by Compliance"}><Download size={17} aria-hidden="true" /></ButtonIcon>{document.status !== "Verified" && <UploadControl compact documentName={document.name} onUpload={onUpload} />}<div className="relative"><ButtonIcon label={`More actions for ${document.name}`} onClick={() => setOpenMore((value) => value === document.id ? null : document.id)}><EllipsisVertical size={18} aria-hidden="true" /></ButtonIcon>{openMore === document.id && <div className="absolute right-0 top-9 z-20 w-48 rounded-md border border-star-200 bg-white p-1 shadow-card"><button type="button" onClick={() => { onNotice({ id: document.id, text: `Document details for ${document.name} are mock data only.` }); setOpenMore(null); }} className="w-full rounded px-3 py-2 text-left text-xs font-bold text-star-700 hover:bg-star-50">Document details</button><button type="button" onClick={() => { onNotice({ id: document.id, text: "This action is not connected to a backend." }); setOpenMore(null); }} className="w-full rounded px-3 py-2 text-left text-xs font-bold text-star-700 hover:bg-star-50">Request an update</button></div>}</div></div></td></tr>)}</tbody></table>{notice && <div className="border-t border-star-100 px-5 py-3 text-xs text-star-muted" role="status">{notice.text}</div>}</div>;
}

function DocumentsMobileCards({ documents, onNotice, onUpload }: { documents: CorporateDocumentRecord[]; onNotice: (notice: Notice) => void; onUpload: (file: File | undefined, name?: string) => void }) { if (!documents.length) return <EmptyState />; return <div className="divide-y divide-star-100 md:hidden">{documents.map((document) => <article key={document.id} className="p-4"><div className="flex gap-3"><FileIcon type={document.fileType} /><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-star-900">{document.name}</p><p className="mt-1 text-xs leading-5 text-star-muted">{document.description}</p></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div><StatusBadge status={document.status} /><p className="mt-1.5 text-xs text-star-muted">Uploaded: {document.uploadedAt}</p></div><div className="flex items-center"><ButtonIcon label={`View ${document.name}`} onClick={() => onNotice({ id: document.id, text: `Viewing ${document.name} is unavailable in this frontend preview.` })} disabled={document.status === "Not Uploaded" || document.status === "Required" || document.status === "Requested by Compliance"}><Eye size={17} aria-hidden="true" /></ButtonIcon><ButtonIcon label={`Download ${document.name}`} onClick={() => onNotice({ id: document.id, text: `Download for ${document.name} is unavailable in this frontend preview.` })} disabled={document.status === "Not Uploaded" || document.status === "Required" || document.status === "Requested by Compliance"}><Download size={17} aria-hidden="true" /></ButtonIcon><UploadControl compact documentName={document.name} onUpload={onUpload} /></div></div></article>)}</div>; }

function EmptyState() { return <div className="flex min-h-[230px] flex-col items-center justify-center px-5 text-center"><FileText size={31} className="text-star-300" aria-hidden="true" /><h3 className="mt-3 text-base font-extrabold text-star-700">No documents available</h3><p className="mt-1 max-w-sm text-sm leading-6 text-star-muted">Documents for this category will appear here when available.</p></div>; }

function RequiredDocumentsPanel({ documents }: { documents: CorporateDocumentRecord[] }) { return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="required-documents-heading"><h2 id="required-documents-heading" className="text-base font-extrabold text-star-900">Required Documents</h2><ul className="mt-4 space-y-3">{documents.map((document) => { const complete = document.status === "Verified" || document.status === "Uploaded" || document.status === "Pending Review"; return <li key={document.id} className="flex items-start gap-2.5 text-xs leading-5 text-star-muted"><span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${complete ? "bg-[#d9f3e0] text-[#168348]" : "bg-star-100 text-star-muted"}`}>{complete ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}</span><span>{document.name}{!document.applicable ? " — if applicable" : ""}</span></li>; })}</ul></section>; }

function DocumentGuidelines() { return <section className="rounded-xl border border-[#cce7d0] bg-[#eff8f0] p-5" aria-labelledby="document-guidelines-heading"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#16743d] text-white"><Info size={19} aria-hidden="true" /></span><h2 id="document-guidelines-heading" className="text-base font-extrabold text-star-900">Document Guidelines</h2></div><ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-5 text-star-muted">{documentGuidelines.map((guideline) => <li key={guideline}>{guideline}</li>)}</ul></section>; }

function HelpPanel() { return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="documents-help-heading"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#1676b3] text-white"><HelpCircle size={20} aria-hidden="true" /></span><h2 id="documents-help-heading" className="text-base font-extrabold text-star-900">Need help?</h2></div><p className="mt-3 text-xs leading-5 text-star-muted">If you have any questions about the documents required, please contact your relationship manager.</p><a href="mailto:corporate@starfetchinvestltd.com.ng" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-star-200 px-3 py-2.5 text-center text-xs font-extrabold text-star-900 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Contact Relationship Manager<ExternalLink size={15} aria-hidden="true" /></a></section>; }

function SearchAndFilter({ search, onSearch, status, onStatus }: { search: string; onSearch: (value: string) => void; status: "All" | CorporateDocumentStatus; onStatus: (value: "All" | CorporateDocumentStatus) => void }) { return <div className="flex flex-col gap-3 border-b border-star-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><label className="relative block sm:w-[250px]"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-star-muted" aria-hidden="true" /><span className="sr-only">Search documents</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search documents..." className="min-h-10 w-full rounded-md border border-star-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-star-900 outline-none transition placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><label className="relative block sm:w-[188px]"><Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-star-muted" aria-hidden="true" /><span className="sr-only">Filter documents by status</span><select value={status} onChange={(event) => onStatus(event.target.value as "All" | CorporateDocumentStatus)} className="min-h-10 w-full appearance-none rounded-md border border-star-200 bg-white py-2 pl-9 pr-8 text-sm font-bold text-star-700 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100">{documentStatusFilters.map((filter) => <option key={filter}>{filter}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-star-muted" aria-hidden="true" /></label></div>; }

export function CorporateDocumentsContent() {
  const [activeCategory, setActiveCategory] = useState<DocumentCategoryId>("company");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | CorporateDocumentStatus>("All");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const verification = corporateDocumentVerification;
  const category = corporateDocumentCategories.find((item) => item.id === activeCategory)!;
  const documents = useMemo(() => corporateDocumentsByCategory[activeCategory].filter((document) => (filter === "All" || document.status === filter) && `${document.name} ${document.description}`.toLowerCase().includes(search.toLowerCase())), [activeCategory, filter, search]);
  const requiredDocuments = activeCategory === "company" ? requiredCompanyDocuments : corporateDocumentsByCategory[activeCategory].filter((document) => document.required);

  function selectCategory(id: DocumentCategoryId) { setActiveCategory(id); setSearch(""); setFilter("All"); setNotice(null); setLoading(true); window.setTimeout(() => setLoading(false), 220); }
  function uploadDocument(file: File | undefined, name?: string) { if (!file) return; if (file.size > 10 * 1024 * 1024) { setNotice({ id: "upload", text: "This mock upload accepts files up to 10MB." }); return; } setNotice({ id: "upload", text: `${file.name} was selected${name ? ` for ${name}` : ""}. Upload is not sent or stored in this frontend preview.` }); }

  return <main className="min-w-0"><div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Documents</h1><p className="mt-1.5 text-sm leading-6 text-star-muted sm:text-base">Manage your corporate documents, view statements and keep track of requests.</p></div><section className="flex w-full max-w-[340px] items-center gap-3 rounded-lg border border-[#cce7d0] bg-[#eff8f0] px-4 py-3.5" aria-label={verification.heading}><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#168348] text-white"><ShieldCheck size={23} strokeWidth={2.5} aria-hidden="true" /></span><div><h2 className="text-sm font-extrabold text-star-900">{verification.heading}</h2><p className="mt-1 text-xs leading-4 text-star-muted">{verification.detail}</p></div></section></div><CorporateDocumentTabs activeCategory={activeCategory} onSelect={selectCategory} /><div id={`corporate-documents-panel-${activeCategory}`} role="tabpanel" aria-labelledby={`corporate-documents-tab-${activeCategory}`} className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_292px]"><section className="min-w-0 rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="documents-table-heading"><div className="border-b border-star-100 px-5 py-4"><h2 id="documents-table-heading" className="text-xl font-extrabold text-star-900">{category.label}</h2><p className="mt-1 text-sm leading-6 text-star-muted">{activeCategory === "company" ? "Upload the core documents that verify your company’s legal existence and business details." : `Review records and requests in the ${category.label.toLowerCase()} category.`}</p></div><div className="p-5"><UploadPanel onUpload={uploadDocument} /></div><SearchAndFilter search={search} onSearch={setSearch} status={filter} onStatus={setFilter} />{loading ? <DocumentTableSkeleton /> : <><DocumentsDesktopTable documents={documents} notice={notice} onNotice={setNotice} onUpload={uploadDocument} /><DocumentsMobileCards documents={documents} onNotice={setNotice} onUpload={uploadDocument} /></>}</section><aside className="min-w-0 space-y-4"><RequiredDocumentsPanel documents={requiredDocuments} /><DocumentGuidelines /><HelpPanel /></aside></div></main>;
}
