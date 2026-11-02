"use client";

import { ArrowRight, BarChart3, ChevronDown, FileText, Menu, UsersRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button, Logo } from "./ui";

const aboutMenuItems = [
  { label: "Who We Are", href: "/about#who-we-are" },
  { label: "Our Core Values", href: "/about#core-values" },
  { label: "Our Vision", href: "/about#vision" },
  { label: "Our Philosophy", href: "/about#philosophy" },
  { label: "Starfetch Board", href: "/about#starfetch-board" },
  { label: "Team", href: "/about#team" },
];

const serviceMenuItems = [
  {
    title: "Starfetch Fixed Note",
    description: "A structured fixed-income solution designed for investors seeking stability and predictable outcomes.",
    href: "/services#fixed-note",
    icon: FileText,
  },
  {
    title: "Starfetch Discretionary Portfolios",
    description: "Professionally managed portfolios tailored to individual goals, risk appetite and investment horizon.",
    href: "/services#discretionary-portfolios",
    icon: BarChart3,
  },
  {
    title: "Starfetch Execution Mandate",
    description: "Professional access to capital markets with trade execution and dedicated investment support.",
    href: "/services#execution-mandate",
    icon: UsersRound,
  },
];

const navItems = [
  { label: "Home", href: "#home", activePath: "/" },
  { label: "About", href: "/about", activePath: "/about" },
  { label: "Services", href: "/services", activePath: "/services" },
  { label: "Free Tools", href: "#tools" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isAboutMenuOpen, setIsAboutMenuOpen] = useState(false);
  const [isServicesMenuOpen, setIsServicesMenuOpen] = useState(false);
  const [isMobileAboutOpen, setIsMobileAboutOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);
  const aboutTriggerRef = useRef<HTMLAnchorElement>(null);
  const servicesTriggerRef = useRef<HTMLAnchorElement>(null);
  const firstAboutMenuItemRef = useRef<HTMLAnchorElement>(null);
  const firstServiceMenuItemRef = useRef<HTMLAnchorElement>(null);

  const isAboutRoute = pathname.startsWith("/about");
  const linkHref = (href: string) => (href.startsWith("#") && pathname !== "/" ? `/${href}` : href);
  const isActive = (activePath?: string) => activePath === "/about" ? isAboutRoute : pathname === activePath;

  const closeAllMenus = () => {
    setIsOpen(false);
    setIsAboutMenuOpen(false);
    setIsServicesMenuOpen(false);
    setIsMobileAboutOpen(false);
    setIsMobileServicesOpen(false);
  };

  const handleAboutTriggerKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === "ArrowDown" || event.key === " ") {
      event.preventDefault();
      setIsAboutMenuOpen(true);
      setIsServicesMenuOpen(false);
      requestAnimationFrame(() => firstAboutMenuItemRef.current?.focus());
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsAboutMenuOpen(false);
    }
  };

  const handleServicesTriggerKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === "ArrowDown" || event.key === " ") {
      event.preventDefault();
      setIsServicesMenuOpen(true);
      setIsAboutMenuOpen(false);
      requestAnimationFrame(() => firstServiceMenuItemRef.current?.focus());
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsServicesMenuOpen(false);
    }
  };

  const handleAboutMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsAboutMenuOpen(false);
      aboutTriggerRef.current?.focus();
    }
  };

  const handleServicesMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsServicesMenuOpen(false);
      servicesTriggerRef.current?.focus();
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-star-200 bg-white text-star-900 shadow-[0_2px_8px_rgba(0,59,42,0.05)]">
      <div className="mx-auto flex h-[60px] max-w-[1170px] items-center justify-between px-5 lg:px-7">
        <Logo />
        <nav className="hidden h-full items-center gap-6 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = isActive(item.activePath);

            if (item.label === "About") {
              return (
                <div
                  key={item.label}
                  className="flex h-full items-center"
                  onMouseEnter={() => {
                    setIsAboutMenuOpen(true);
                    setIsServicesMenuOpen(false);
                  }}
                  onMouseLeave={(event) => {
                    if (!event.currentTarget.contains(document.activeElement)) {
                      setIsAboutMenuOpen(false);
                    }
                  }}
                  onFocusCapture={() => {
                    setIsAboutMenuOpen(true);
                    setIsServicesMenuOpen(false);
                  }}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsAboutMenuOpen(false);
                    }
                  }}
                >
                  <a
                    ref={aboutTriggerRef}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={isAboutMenuOpen}
                    aria-controls="about-mega-menu"
                    onKeyDown={handleAboutTriggerKeyDown}
                    className={`flex h-full items-center gap-1 border-b-2 text-[0.68rem] font-semibold no-underline transition-colors duration-200 hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-inset ${active ? "border-star-lime text-star-700" : "border-transparent text-star-700"}`}
                  >
                    About
                    <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" className={`transition-transform duration-150 ${isAboutMenuOpen ? "rotate-180" : ""}`} />
                  </a>

                  <div
                    id="about-mega-menu"
                    aria-label="About us sections"
                    aria-hidden={!isAboutMenuOpen}
                    onKeyDown={handleAboutMenuKeyDown}
                    className={`absolute inset-x-0 top-full z-50 border-y border-star-200 bg-white shadow-[0_10px_24px_rgba(0,59,42,0.08)] transition-all duration-150 ease-out ${isAboutMenuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 pointer-events-none opacity-0"}`}
                  >
                    <div className="mx-auto max-w-[1100px] px-7 py-7">
                      <p className="flex items-center gap-2 text-[0.58rem] font-bold uppercase tracking-[0.2em] text-star-700">
                        <span className="h-px w-6 bg-star-lime" aria-hidden="true" />
                        About us
                      </p>
                      <nav className="mt-5 grid grid-cols-2 gap-x-16 border-t border-star-200 pt-4" aria-label="About us sections">
                        {[aboutMenuItems.slice(0, 3), aboutMenuItems.slice(3)].map((column, columnIndex) => (
                          <div key={columnIndex} className="grid gap-1">
                            {column.map((aboutItem, itemIndex) => (
                              <a
                                key={aboutItem.label}
                                ref={columnIndex === 0 && itemIndex === 0 ? firstAboutMenuItemRef : undefined}
                                href={aboutItem.href}
                                onClick={closeAllMenus}
                                className="w-fit rounded px-2 py-2 text-sm font-semibold text-star-700 no-underline transition-colors duration-150 hover:bg-star-50 hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                              >
                                {aboutItem.label}
                              </a>
                            ))}
                          </div>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.label === "Services") {
              return (
                <div
                  key={item.label}
                  className="flex h-full items-center"
                  onMouseEnter={() => {
                    setIsServicesMenuOpen(true);
                    setIsAboutMenuOpen(false);
                  }}
                  onMouseLeave={(event) => {
                    if (!event.currentTarget.contains(document.activeElement)) {
                      setIsServicesMenuOpen(false);
                    }
                  }}
                  onFocusCapture={() => {
                    setIsServicesMenuOpen(true);
                    setIsAboutMenuOpen(false);
                  }}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsServicesMenuOpen(false);
                    }
                  }}
                >
                  <a
                    ref={servicesTriggerRef}
                    href={linkHref(item.href)}
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={isServicesMenuOpen}
                    aria-controls="services-mega-menu"
                    onKeyDown={handleServicesTriggerKeyDown}
                    className={`flex h-full items-center gap-1 border-b-2 text-[0.68rem] font-semibold no-underline transition-colors duration-200 hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-inset ${active ? "border-star-lime text-star-700" : "border-transparent text-star-700"}`}
                  >
                    Services
                    <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" className={`transition-transform duration-150 ${isServicesMenuOpen ? "rotate-180" : ""}`} />
                  </a>

                  <div
                    id="services-mega-menu"
                    aria-label="Investment solutions"
                    aria-hidden={!isServicesMenuOpen}
                    onKeyDown={handleServicesMenuKeyDown}
                    className={`absolute inset-x-0 top-full z-50 border-y border-star-200 bg-white shadow-[0_10px_24px_rgba(0,59,42,0.08)] transition-all duration-150 ease-out ${isServicesMenuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 pointer-events-none opacity-0"}`}
                  >
                    <div className="mx-auto max-w-[1100px] px-7 py-7">
                      <p className="flex items-center gap-2 text-[0.58rem] font-bold uppercase tracking-[0.2em] text-star-700">
                        <span className="h-px w-6 bg-star-lime" aria-hidden="true" />
                        Investment solutions
                      </p>
                      <nav className="mt-5 grid grid-cols-3 divide-x divide-star-200 border-t border-star-200 pt-4" aria-label="Investment solutions">
                        {serviceMenuItems.map(({ title, description, href, icon: Icon }, index) => (
                          <a
                            key={title}
                            ref={index === 0 ? firstServiceMenuItemRef : undefined}
                            href={href}
                            onClick={closeAllMenus}
                            className="group px-5 py-2 first:pl-0 last:pr-0 no-underline transition-colors duration-200 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                          >
                            <span className="flex items-start gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-star-100 text-star-700 transition-colors duration-200 group-hover:bg-star-lime" aria-hidden="true">
                                <Icon size={18} strokeWidth={2.1} />
                              </span>
                              <span>
                                <span className="block text-sm font-bold text-star-900 transition-colors duration-200 group-hover:text-star-limeDark">{title}</span>
                                <span className="mt-1 block text-[0.72rem] leading-5 text-star-muted">{description}</span>
                                <span className="mt-3 inline-flex items-center gap-1 text-[0.68rem] font-bold text-star-700 transition-colors duration-200 group-hover:text-star-limeDark">
                                  Learn more <ArrowRight size={13} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
                                </span>
                              </span>
                            </span>
                          </a>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <a
                key={item.label}
                href={linkHref(item.href)}
                aria-current={active ? "page" : undefined}
                onClick={closeAllMenus}
                className={`flex h-full items-center border-b-2 text-[0.68rem] font-semibold no-underline transition-colors duration-200 hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-inset ${active ? "border-star-lime text-star-700" : "border-transparent text-star-700"}`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button href="/open-account" variant="outline" className="rounded-[4px] bg-white px-3.5 py-2 text-[0.66rem]">Open an Account</Button>
          <Button href="/login" variant="lime" className="rounded-[4px] px-4 py-2 text-[0.66rem]">Log In</Button>
        </div>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded border border-star-200 bg-white text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 lg:hidden"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          onClick={() => {
            setIsOpen((open) => !open);
            if (isOpen) {
              setIsMobileAboutOpen(false);
              setIsMobileServicesOpen(false);
            }
          }}
        >
          {isOpen ? <X size={19} /> : <Menu size={20} />}
        </button>
      </div>

      <div id="mobile-navigation" className={`${isOpen ? "grid" : "hidden"} border-t border-star-200 bg-white px-5 pb-5 pt-3 shadow-[0_8px_18px_rgba(0,59,42,0.05)] lg:hidden`}>
        <nav className="grid gap-0.5" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const active = isActive(item.activePath);

            if (item.label === "About") {
              return (
                <div key={item.label} className="rounded">
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={isMobileAboutOpen}
                    aria-controls="mobile-about-sections"
                    onClick={() => {
                      setIsMobileAboutOpen((open) => !open);
                      setIsMobileServicesOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${active ? "bg-star-100 text-star-700" : "text-star-700 hover:bg-star-50 hover:text-star-limeDark"}`}
                  >
                    About
                    <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" className={`transition-transform duration-150 ${isMobileAboutOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div id="mobile-about-sections" className={`${isMobileAboutOpen ? "grid" : "hidden"} ml-3 mt-1 gap-0.5 border-l border-star-200 pl-3`}>
                    {aboutMenuItems.map((aboutItem) => (
                      <a
                        key={aboutItem.label}
                        href={aboutItem.href}
                        onClick={closeAllMenus}
                        className="rounded px-3 py-2 text-[0.82rem] font-medium text-star-muted no-underline transition-colors duration-150 hover:bg-star-50 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                      >
                        {aboutItem.label}
                      </a>
                    ))}
                  </div>
                </div>
              );
            }

            if (item.label === "Services") {
              return (
                <div key={item.label} className="rounded">
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={isMobileServicesOpen}
                    aria-controls="mobile-services-sections"
                    onClick={() => {
                      setIsMobileServicesOpen((open) => !open);
                      setIsMobileAboutOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${active ? "bg-star-100 text-star-700" : "text-star-700 hover:bg-star-50 hover:text-star-limeDark"}`}
                  >
                    Services
                    <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" className={`transition-transform duration-150 ${isMobileServicesOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div id="mobile-services-sections" className={`${isMobileServicesOpen ? "grid" : "hidden"} ml-3 mt-1 gap-0.5 border-l border-star-200 pl-3`}>
                    {serviceMenuItems.map((serviceItem) => (
                      <a
                        key={serviceItem.title}
                        href={serviceItem.href}
                        onClick={closeAllMenus}
                        className="rounded px-3 py-2 text-[0.82rem] font-medium text-star-muted no-underline transition-colors duration-150 hover:bg-star-50 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                      >
                        {serviceItem.title}
                      </a>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <a
                key={item.label}
                href={linkHref(item.href)}
                aria-current={active ? "page" : undefined}
                onClick={closeAllMenus}
                className={`rounded px-3 py-2.5 text-sm font-semibold no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${active ? "bg-star-100 text-star-700" : "text-star-700 hover:bg-star-50 hover:text-star-limeDark"}`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Button href="/open-account" onClick={closeAllMenus} variant="outline" className="rounded-[4px] bg-white px-2 py-2.5 text-xs">Open Account</Button>
          <Button href="/login" onClick={closeAllMenus} variant="lime" className="rounded-[4px] px-2 py-2.5 text-xs">Log In</Button>
        </div>
      </div>
    </header>
  );
}
