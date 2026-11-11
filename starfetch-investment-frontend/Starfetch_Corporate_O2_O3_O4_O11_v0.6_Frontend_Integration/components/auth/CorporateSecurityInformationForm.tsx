"use client";

import type { ChangeEvent } from "react";
import { ShieldCheck } from "lucide-react";
import type { CorporateApplicationData, CorporateFieldErrors } from "./corporate-onboarding-data";

type Props = {
  data: CorporateApplicationData;
  errors: CorporateFieldErrors;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

/** No Corporate PIN is collected or used as an onboarding authentication mechanism. */
export function CorporateSecurityInformationForm({ data, errors, onChange }: Props) {
  return (
    <section className={`rounded-xl border p-5 ${errors.authorizationConfirmed ? "border-red-300 bg-red-50" : "border-star-200 bg-star-50"}`} aria-labelledby="business-authorization-heading">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-star-700 shadow-sm"><ShieldCheck size={20} aria-hidden="true" /></span><div className="min-w-0"><h3 id="business-authorization-heading" className="text-base font-extrabold text-star-900">Authorization confirmation</h3><p className="mt-1 text-sm leading-6 text-star-muted">Confirm that you are authorised to prepare this Corporate draft. This confirmation does not submit an application or create an account.</p><label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-star-muted"><input name="authorizationConfirmed" type="checkbox" checked={data.authorizationConfirmed} onChange={onChange} aria-invalid={Boolean(errors.authorizationConfirmed)} aria-describedby={errors.authorizationConfirmed ? "business-authorization-error" : undefined} className="mt-1 size-4 shrink-0 rounded border-star-300 text-star-700 focus:ring-2 focus:ring-star-700" /><span>I confirm that I am authorised to provide these business details for a future Corporate application.</span></label>{errors.authorizationConfirmed ? <p id="business-authorization-error" role="alert" className="mt-2 text-xs font-medium text-red-700">{errors.authorizationConfirmed}</p> : null}</div></div>
    </section>
  );
}
