"use client";

import { useState } from "react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.5a4.7 4.7 0 0 1-2.04 3.08v2.52h3.31c1.94-1.79 3.03-4.42 3.03-7.43Z" />
      <path fill="#34A853" d="M12 22c2.76 0 5.08-.92 6.77-2.34l-3.31-2.52c-.92.62-2.1.99-3.46.99-2.66 0-4.91-1.8-5.72-4.22H2.86v2.6A10.22 10.22 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.28 13.91A6.14 6.14 0 0 1 5.96 12c0-.66.11-1.3.32-1.91v-2.6H2.86A10.2 10.2 0 0 0 1.78 12c0 1.65.4 3.21 1.08 4.51l3.42-2.6Z" />
      <path fill="#EA4335" d="M12 5.87c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.07 2.82 14.76 2 12 2a10.22 10.22 0 0 0-9.14 5.49l3.42 2.6C7.09 7.67 9.34 5.87 12 5.87Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      <path d="M16.68 12.73c.02-1.88 1.54-2.79 1.61-2.83a3.46 3.46 0 0 0-2.73-1.47c-1.15-.12-2.27.69-2.86.69-.6 0-1.5-.67-2.47-.65a3.64 3.64 0 0 0-3.06 1.86c-1.32 2.28-.34 5.63.93 7.49.64.91 1.38 1.92 2.35 1.88.95-.04 1.31-.61 2.46-.61 1.12 0 1.46.61 2.47.59 1.02-.02 1.67-.91 2.28-1.83a7.46 7.46 0 0 0 1.04-2.12 3.23 3.23 0 0 1-2.02-3ZM14.81 7.21a3.32 3.32 0 0 0 .76-2.43 3.38 3.38 0 0 0-2.2 1.13 3.16 3.16 0 0 0-.78 2.34c.84.07 1.7-.43 2.22-1.04Z" />
    </svg>
  );
}

export function SocialAuthButtons() {
  const [notice, setNotice] = useState("");

  function showPlaceholder(provider: "Google" | "Apple") {
    setNotice(`${provider} sign-in is a frontend placeholder and is not connected yet.`);
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => showPlaceholder("Google")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-bold text-star-900 transition hover:border-star-300 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => showPlaceholder("Apple")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-bold text-star-900 transition hover:border-star-300 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          <AppleIcon />
          Continue with Apple
        </button>
      </div>
      {notice ? <p role="status" className="mt-3 text-center text-xs leading-5 text-star-muted">{notice}</p> : null}
    </div>
  );
}
