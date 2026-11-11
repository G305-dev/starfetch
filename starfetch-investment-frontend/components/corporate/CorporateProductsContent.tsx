import { LockKeyhole, PackageOpen } from "lucide-react";
import Link from "next/link";

export function CorporateProductsContent({ requestedProduct = false }: { requestedProduct?: boolean }) {
  return (
    <main aria-labelledby="corporate-products-heading">
      <header><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Corporate investments</p><h1 id="corporate-products-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">{requestedProduct ? "Product access" : "Products"}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Corporate product selection does not create an investment, booking, funding request or account authorisation.</p></header>
      <section className="mt-6 rounded-xl border border-star-200 bg-white p-6 text-center shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-8"><span className="mx-auto grid size-12 place-items-center rounded-full bg-star-100 text-star-700"><PackageOpen size={24} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">Product actions are unavailable</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-star-muted">Corporate investment access remains unavailable until the application, staff review and account permissions are confirmed through approved backend APIs.</p><button type="button" disabled className="mt-5 inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-star-100 px-4 text-sm font-extrabold text-star-muted"><LockKeyhole size={16} aria-hidden="true" />Investment action unavailable</button><div className="mt-5"><Link href="/corporate/dashboard#verification" className="text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 hover:text-star-900">Review verification progress</Link></div></section>
    </main>
  );
}
