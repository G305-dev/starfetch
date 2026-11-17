"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, Info, X } from "lucide-react";
import { serviceDetails } from "@/components/services/services-data";

type ProductDetail = (typeof serviceDetails)[number];

/**
 * Corporate-only product routes. Corporate investors must never be sent to
 * Individual Investor routes, so every product destination is pinned to the
 * Corporate Portal here rather than inherited from Individual defaults.
 */
const CORPORATE_FIXED_NOTE_HREF = "/corporate/products/fixed-note";

/**
 * Corporate Products presentation.
 *
 * This component intentionally reuses only the shared product catalogue
 * (`serviceDetails`) and the approved card/modal presentation from the
 * Individual Products page. It does not reuse the Individual product
 * workflow: there are no Individual investment actions, no Individual KYC
 * endpoints, no Individual profile navigation and no Individual portfolio
 * information. Corporate investment execution is not an approved backend
 * workflow, so the investment-action button opens a Corporate-specific
 * unavailable notice instead of creating an order, funding request or
 * enquiry.
 */
export function CorporateProductsContent({ requestedProduct = false }: { requestedProduct?: boolean } = {}) {
  // `requestedProduct` is retained only for compatibility with the reference
  // integration snapshot, which still passes it. It has no effect: the
  // Corporate Products page always renders the full product listing, and the
  // Corporate Fixed Note page now uses CorporateFixedNoteInfo.
  void requestedProduct;
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [investmentActionProduct, setInvestmentActionProduct] = useState<ProductDetail | null>(null);

  const openCorporateInvestmentAction = (product: ProductDetail) => {
    setSelectedProduct(null);
    setInvestmentActionProduct(product);
  };

  const viewInvestmentActionProductDetails = () => {
    if (!investmentActionProduct) return;
    setSelectedProduct(investmentActionProduct);
    setInvestmentActionProduct(null);
  };

  return (
    <section aria-labelledby="products-page-heading">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-star-700">Investment solutions</p>
        <h1 id="products-page-heading" className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">
          Products
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-[0.96rem]">
          Explore Starfetch investment solutions for your company and learn how each mandate may support your investment goals.
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {serviceDetails.map((service) => (
          <article
            key={service.id}
            className="relative min-h-[270px] overflow-hidden rounded-xl border border-star-200 bg-white p-6 shadow-[0_3px_14px_rgba(0,59,42,0.045)] transition-shadow duration-200 hover:shadow-card sm:p-7"
          >
            <div className="relative z-10 flex h-full max-w-[65%] flex-col">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-star-700">{service.eyebrow}</p>
              <h2 className="mt-3 text-xl font-extrabold tracking-[-0.025em] text-star-900">{service.title}</h2>
              <p className="mt-3 text-sm leading-6 text-star-muted">{service.description}</p>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(service)}
                  aria-haspopup="dialog"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-star-200 bg-white px-3.5 text-sm font-extrabold text-star-900 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                >
                  View Details <ArrowRight size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => openCorporateInvestmentAction(service)}
                  aria-haspopup="dialog"
                  className="inline-flex min-h-10 items-center rounded-md bg-star-lime px-3.5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
                >
                  Invest Now
                </button>

                {service.id === "fixed-note" ? (
                  <Link
                    href={CORPORATE_FIXED_NOTE_HREF}
                    className="inline-flex min-h-10 items-center rounded-md border border-star-200 bg-white px-3.5 text-sm font-extrabold text-star-900 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                  >
                    View Fixed Note
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="absolute bottom-0 right-0 top-0 w-[43%] bg-star-50">
              <Image
                src={service.image}
                alt={service.imageAlt}
                fill
                sizes="(max-width: 1023px) 43vw, 300px"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0)_55%)]" />
            </div>
            <span className="absolute bottom-5 right-5 z-10 grid size-10 place-items-center rounded-full bg-star-700 text-star-lime shadow-card">
              <BriefcaseBusiness size={19} aria-hidden="true" />
            </span>
          </article>
        ))}
      </div>

      <p className="mt-6 rounded-lg border border-star-200 bg-star-50 px-4 py-3 text-xs leading-5 text-star-muted">
        Products are informational. Online investment execution, funding, bookings, and enquiry submission are not available in the Corporate Portal. Corporate investment execution will be enabled only after an approved backend workflow is available.
      </p>

      {selectedProduct ? (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onInvestNow={openCorporateInvestmentAction}
        />
      ) : null}

      {investmentActionProduct ? (
        <CorporateInvestmentActionModal
          product={investmentActionProduct}
          onClose={() => setInvestmentActionProduct(null)}
          onViewDetails={viewInvestmentActionProductDetails}
        />
      ) : null}
    </section>
  );
}

function CorporateInvestmentActionModal({
  product,
  onClose,
  onViewDetails,
}: {
  product: ProductDetail;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-star-900/45 px-5 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="corporate-invest-now-heading"
      aria-describedby="corporate-invest-now-description"
    >
      <section className="relative w-full max-w-lg rounded-2xl border border-star-200 bg-white p-6 shadow-[0_20px_55px_rgba(0,59,42,0.28)] sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close investment action notice"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-star-muted transition hover:bg-star-50 hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
        >
          <X size={19} aria-hidden="true" />
        </button>
        <span className="grid size-11 place-items-center rounded-full bg-star-100 text-star-700">
          <Info size={22} aria-hidden="true" />
        </span>
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">{product.eyebrow}</p>
        <h2 id="corporate-invest-now-heading" className="mt-2 pr-10 text-xl font-extrabold tracking-[-0.025em] text-star-900">
          Corporate investment actions are unavailable
        </h2>
        <p id="corporate-invest-now-description" className="mt-3 text-sm leading-6 text-star-muted">
          {product.title} cannot be opened through the Corporate Portal. No investment instruction, booking, funding request, enquiry, or company information will be submitted. Corporate investment execution will be enabled only after an approved backend workflow is available.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onViewDetails}
            className="min-h-10 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
          >
            View Product Details
          </button>
        </div>
      </section>
    </div>
  );
}

function ProductDetailsModal({
  product,
  onClose,
  onInvestNow,
}: {
  product: ProductDetail;
  onClose: () => void;
  onInvestNow: (product: ProductDetail) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-star-900/45 px-5 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-details-heading"
      aria-describedby="product-details-description"
    >
      <section className="relative max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-star-200 bg-white p-6 shadow-[0_20px_55px_rgba(0,59,42,0.28)] sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-star-muted transition hover:bg-star-50 hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
        >
          <X size={19} aria-hidden="true" />
        </button>
        <p className="pr-10 text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">{product.eyebrow}</p>
        <h2 id="product-details-heading" className="mt-3 pr-10 font-display text-2xl font-extrabold tracking-[-0.04em] text-star-900">
          {product.title}
        </h2>
        <p id="product-details-description" className="mt-4 text-sm leading-6 text-star-ink">{product.description}</p>
        <p className="mt-3 text-sm leading-6 text-star-muted">{product.supportingDescription}</p>

        <div className="mt-6 grid gap-5 rounded-xl border border-star-200 bg-star-50 p-5 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-700">Typical use</h3>
            <p className="mt-2 text-sm leading-6 text-star-muted">{product.typicalUse}</p>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-700">Risk character</h3>
            <p className="mt-2 text-sm leading-6 text-star-muted">{product.riskCharacter}</p>
          </div>
        </div>

        <div className="mt-6 border-t border-star-100 pt-5">
          <h3 className="text-sm font-extrabold text-star-900">How it works</h3>
          <div className="mt-2 space-y-2 text-sm leading-6 text-star-muted">
            {product.howItWorks.map((item) => <p key={item}>{item}</p>)}
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onInvestNow(product)}
            aria-haspopup="dialog"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-star-lime px-4 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Invest Now
          </button>
          {product.id === "fixed-note" ? (
            <Link
              href={CORPORATE_FIXED_NOTE_HREF}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
            >
              View Fixed Note
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
