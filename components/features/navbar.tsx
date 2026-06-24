"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, User, LogOut, BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomerAuth } from "@/lib/customerStore";

export default function Navbar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const [isOpen,       setIsOpen]       = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, hydrated, customer, logout } = useCustomerAuth();

  // Close mobile menu on resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setIsOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navItems = [
    { label: "Home",        href: "/"            },
    { label: "About Us",    href: "/about-us"    },
    { label: "Our Product", href: "/our-products" },
    { label: "Contact Us",  href: "/contact-us"  },
  ];

  const loggedIn = hydrated && isLoggedIn;

  return (
    <>
      {/* ── Green logo banner ── */}
      <div className="w-full bg-[#8cc63f] flex items-center justify-center py-3 px-4">
        <Link href="/" className="transition-transform hover:scale-[1.01] active:scale-[0.99]">
          <Image src="/main-logo.png" alt="Jetrique" width={280} height={70} priority
            className="h-11 md:h-13 w-auto object-contain" />
        </Link>
      </div>

      {/* ── Charcoal separator ── */}
      <div className="w-full h-3.5 bg-[#3a3a3a]" />

      {/* ── Main nav bar ── */}
      <nav className="w-full bg-white shadow-sm relative z-40">

        {/* ━━ DESKTOP (md+) ━━ */}
        <div className="hidden md:grid items-center h-[56px] px-6 lg:px-12"
          style={{ gridTemplateColumns: "1fr auto 1fr" }}>

          {/* Left: nav links */}
          <div className="flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    "text-[13px] lg:text-[14px] px-3 py-1.5 rounded-[9px] font-normal border-2 whitespace-nowrap transition-all duration-150",
                    active
                      ? "border-[#8cc63f] text-[#8cc63f]"
                      : "border-transparent text-[#4a4a4a] hover:text-[#8cc63f] hover:border-[#8cc63f]/30 hover:bg-[#8cc63f]/5"
                  )}>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Center: empty (logo is in banner above) */}
          <div />

          {/* Right actions */}
          <div className="flex items-center justify-end gap-2 lg:gap-3 shrink-0">

            {/* Book Now */}
            <Link href="/book"
              className={cn(
                "flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-[8px] transition-all whitespace-nowrap border-2",
                pathname.startsWith("/book")
                  ? "bg-[#8cc63f] border-[#8cc63f] text-white"
                  : "bg-[#3a3a3a] border-[#3a3a3a] text-white hover:bg-[#8cc63f] hover:border-[#8cc63f]"
              )}>
              <BookOpen className="size-3.5" />
              Book Now
            </Link>

            {/* Language */}
            <button className="flex items-center gap-1.5 text-[13px] text-[#4a4a4a] hover:text-[#8cc63f] transition-colors cursor-pointer px-2">
              <Image src="/icons/Icons-03.svg" alt="EN" width={20} height={20} />
              <span className="hidden lg:inline">English</span>
            </button>

            {/* Divider */}
            <div className="h-5 w-px bg-neutral-200 mx-1" />

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-2 py-1.5 pl-1 pr-2 rounded-[9px] transition-all",
                  loggedIn ? "hover:bg-neutral-50" : "hover:bg-neutral-50"
                )}>
                {loggedIn ? (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                    style={{ background: "#3a3a3a" }}>
                    {customer?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                    <User className="size-3.5 text-neutral-500" />
                  </div>
                )}
                <span className="text-[13px] font-medium text-[#4a4a4a] max-w-[80px] truncate">
                  {loggedIn ? (customer?.name?.split(" ")[0] ?? "Account") : "Login"}
                </span>
                <ChevronDown className={cn(
                  "size-3.5 text-neutral-400 transition-transform duration-200",
                  userMenuOpen && "rotate-180"
                )} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-neutral-100 rounded-[14px] shadow-2xl overflow-hidden z-50">
                  {loggedIn ? (
                    <>
                      {/* User info header */}
                      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100 bg-neutral-50/80">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                          style={{ background: "#3a3a3a" }}>
                          {customer?.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-neutral-800 truncate">{customer?.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{customer?.email}</p>
                        </div>
                      </div>
                      <div className="py-1">
                        <Link href="/account" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
                          <BookOpen className="size-3.5 text-neutral-400 shrink-0" />
                          My Bookings
                        </Link>
                      </div>
                      <div className="border-t border-neutral-100" />
                      <div className="py-1">
                        <button
                          onClick={() => { logout(); setUserMenuOpen(false); router.push("/"); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors">
                          <LogOut className="size-3.5 shrink-0" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-1">
                      <Link href="/login" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[#8cc63f] hover:bg-[#8cc63f]/5 transition-colors">
                        <User className="size-3.5 shrink-0" />
                        Sign In
                      </Link>
                      <div className="border-t border-neutral-100 mx-3" />
                      <Link href="/book" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-neutral-600 hover:bg-neutral-50 transition-colors">
                        <BookOpen className="size-3.5 text-neutral-400 shrink-0" />
                        Book a Flight
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ━━ MOBILE (< md) ━━ */}
        <div className="flex md:hidden items-center justify-between h-[52px] px-4">

          {/* Hamburger */}
          <button onClick={() => setIsOpen((o) => !o)}
            className="p-2 rounded-[8px] text-[#3a3a3a] hover:bg-neutral-50 transition-colors"
            aria-label="Menu">
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          {/* Right: Book + User + Language */}
          <div className="flex items-center gap-2">
            <Link href="/book"
              className={cn(
                "flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-[7px] transition-colors whitespace-nowrap",
                pathname.startsWith("/book")
                  ? "bg-[#8cc63f] text-white"
                  : "bg-[#3a3a3a] text-white hover:bg-[#8cc63f]"
              )}>
              <BookOpen className="size-3" />
              Book
            </Link>

            <Link href={loggedIn ? "/account" : "/login"}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors",
                loggedIn
                  ? "border-[#8cc63f]/40 bg-[#3a3a3a] text-white"
                  : "border-neutral-200 text-neutral-500 hover:border-[#8cc63f] hover:text-[#8cc63f]"
              )}>
              {loggedIn
                ? <span className="text-[11px] font-bold">{customer?.name?.[0]?.toUpperCase()}</span>
                : <User className="size-3.5" />
              }
            </Link>

            <button className="flex items-center cursor-pointer">
              <Image src="/icons/Icons-03.svg" alt="EN" width={20} height={20} />
            </button>
          </div>
        </div>

        {/* ━━ MOBILE MENU DROPDOWN ━━ */}
        {isOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-t border-neutral-100 shadow-lg z-50
            animate-in fade-in slide-in-from-top-2 duration-200">

            {/* Nav links */}
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center px-4 py-2.5 rounded-[10px] text-[14px] transition-all",
                      active
                        ? "bg-[#8cc63f]/10 text-[#8cc63f] font-medium border border-[#8cc63f]/30"
                        : "text-[#4a4a4a] hover:bg-neutral-50 hover:text-[#8cc63f]"
                    )}>
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Auth section */}
            <div className="border-t border-neutral-100 px-4 py-3">
              {loggedIn ? (
                <>
                  <div className="flex items-center gap-3 px-2 py-2 mb-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                      style={{ background: "#3a3a3a" }}>
                      {customer?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-neutral-800 truncate">{customer?.name}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{customer?.email}</p>
                    </div>
                  </div>
                  <Link href="/account" onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-[13px] text-neutral-600 hover:bg-neutral-50">
                    <BookOpen className="size-3.5 text-neutral-400" /> My Bookings
                  </Link>
                  <button onClick={() => { logout(); setIsOpen(false); router.push("/"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-[13px] text-red-500 hover:bg-red-50 mt-1">
                    <LogOut className="size-3.5" /> Sign Out
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border-2 border-[#8cc63f] text-[#8cc63f] text-[13px] font-semibold bg-[#8cc63f]/5 hover:bg-[#8cc63f]/10 transition-colors">
                  <User className="size-4" /> Sign In / Register
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
