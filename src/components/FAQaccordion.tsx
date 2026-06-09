// components/FAQAccordion.tsx
'use client'

import React, { useState } from 'react'

type FAQItem = { q: string; a: string }

export default function FAQAccordion({ faqs }: { faqs: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <>
      {faqs.map((faq, i) => (
        <div className="faq-item" key={i}>
          <button
            className="faq-question"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span className="faq-question-text">{faq.q}</span>
            <svg
              className={`faq-chevron${open === i ? ' open' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div
            className={`faq-answer${open === i ? ' open' : ''}`}
            role="region"
          >
            <p className="faq-answer-inner">{faq.a}</p>
          </div>
        </div>
      ))}
    </>
  )
}
