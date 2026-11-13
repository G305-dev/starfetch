"use client";

import { useEffect, useRef } from "react";

type TradingViewWidgetProps = {
  ariaLabel: string;
  className?: string;
  configuration: Record<string, unknown>;
  scriptSrc: string;
};

/**
 * Mounts one official TradingView embed script for one widget container.
 * The configuration is serialised as script content, matching TradingView's
 * embed format while keeping third-party DOM work outside React rendering.
 */
export function TradingViewWidget({ ariaLabel, className, configuration, scriptSrc }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const configurationJson = JSON.stringify(configuration);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren();
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.type = "text/javascript";
    script.async = true;
    script.textContent = configurationJson;
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [configurationJson, scriptSrc]);

  return <div ref={containerRef} className={className} aria-label={ariaLabel} />;
}
