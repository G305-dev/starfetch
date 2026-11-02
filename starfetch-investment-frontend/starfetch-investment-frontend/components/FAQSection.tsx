"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { faqs } from "./site-data";
import { SectionHeading } from "./ui";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const idPrefix = useId();

  return (
    <section className="bg-[#fffef9] py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 lg:grid-cols-[0.76fr_1.24fr] lg:gap-16 lg:px-7">
        <SectionHeading
          eyebrow="Frequently asked questions"
          title="Your questions, answered"
          description="A few helpful answers before you start a conversation with our team."
        />
        <div className="rounded-lg border border-star-200 bg-white px-5 shadow-[0_3px_12px_rgba(0,59,42,0.035)] sm:px-6">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const contentId = `${idPrefix}-${index}`;
            return (
              <div key={faq.question} className={index === faqs.length - 1 ? "" : "border-b border-star-200"}>
                <h3>
                  <button
                    type="button"
                    className="group flex w-full items-center justify-between gap-5 py-5 text-left text-[0.94rem] font-bold leading-5 text-star-900 transition-colors duration-200 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => setOpenIndex((current) => current === index ? null : index)}
                  >
                    {faq.question}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-star-100 text-star-700 transition-transform duration-300 ease-out group-hover:scale-110" aria-hidden="true">
                      {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                    </span>
                  </button>
                </h3>
                <div
                  id={contentId}
                  role="region"
                  aria-label={faq.question}
                  aria-hidden={!isOpen}
                  className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="max-w-2xl pb-5 pr-6 text-sm leading-6 text-star-muted">
                      {faq.answers.map((answer) => <p key={answer} className="mb-3 last:mb-0">{answer}</p>)}
                      {faq.action ? (
                        <a
                          href={faq.action.href}
                          className="mt-4 inline-flex items-center rounded-md bg-star-lime px-4 py-2 text-xs font-bold text-star-900 no-underline transition duration-200 ease-out hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_5px_14px_rgba(0,59,42,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
                        >
                          {faq.action.label}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
