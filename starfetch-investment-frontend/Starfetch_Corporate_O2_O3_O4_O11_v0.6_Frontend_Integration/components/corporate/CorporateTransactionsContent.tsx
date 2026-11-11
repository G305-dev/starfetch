import { ReceiptText } from "lucide-react";

export function CorporateTransactionsContent() {
  return (
    <main aria-labelledby="corporate-transactions-heading">
      <header><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Corporate portfolio</p><h1 id="corporate-transactions-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Transactions</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Transaction history will be available only after an approved Corporate transaction API returns authorised account records.</p></header>
      <section className="mt-6 rounded-xl border border-star-200 bg-white p-6 text-center shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-8"><span className="mx-auto grid size-12 place-items-center rounded-full bg-star-100 text-star-700"><ReceiptText size={24} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">No transaction data available</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-star-muted">The portal does not replace unavailable Corporate transaction data with sample subscriptions, redemptions, payouts, fees or receipts.</p></section>
    </main>
  );
}
