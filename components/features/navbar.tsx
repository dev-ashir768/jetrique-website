"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close the mobile menu if screen size is resized above the mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 425) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about-us" },
    { label: "Our Product", href: "/our-products" },
    { label: "Contact Us", href: "/contact-us" },
  ];

  return (
    <>
      {/* Top Brand-Green Banner */}
      <div className="w-full bg-[#8cc63f] py-3 md:py-3 flex items-center justify-center px-4">
        <Link href="/" className="relative transition-transform hover:scale-[1.01] active:scale-[0.99]">
          <Image
            src="/main-logo.png"
            alt="Jetrique Logo"
            width={280}
            height={70}
            priority
            className="h-12 md:h-14 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Dark Charcoal Separator Bar */}
      <div className="w-full h-3.5 bg-[#3a3a3a]" />

      {/* Navigation Bar Menu */}
      <nav className="w-full bg-white py-3 md:py-4 shadow-sm relative">
        <div className="container mx-auto px-4">
          
          {/* Desktop Layout (visible on screens >= 426px) */}
          <div className="hidden min-[576px]:flex items-center justify-around gap-2 md:gap-10 lg:gap-12 text-sm font-medium text-[#4a4a4a]">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "transition-all duration-200 text-[10px] md:text-[12px] lg:text-[15px] px-5 py-1.5 rounded-[10px] font-normal border-2",
                    isActive
                      ? "border-[#8cc63f] text-[#8cc63f]"
                      : "border-transparent text-[#4a4a4a] hover:text-[#8cc63f] hover:border-[#8cc63f]/40 hover:bg-[#8cc63f]/5"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Language Selector */}
            <button className="flex items-center gap-1.5 hover:text-[#8cc63f] transition-colors text-[12px] lg:text-[15px] cursor-pointer">
              <Image 
                src={"/icons/Icons-03.svg"}
                alt="UK Flag"
                width={24}
                height={24}
              />
              <span>English</span>
            </button>
          </div>

          {/* Mobile Layout (visible on screens <= 425px) */}
          <div className="flex min-[576px]:hidden items-center justify-between w-full px-2">
            {/* Hamburger Menu Icon on the Left */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 hover:bg-[#8cc63f]/5 rounded-lg transition-colors cursor-pointer text-[#3a3a3a] hover:text-[#8cc63f] flex items-center justify-center"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Language Selector on the Right */}
            <button className="flex items-center gap-1.5 hover:text-[#8cc63f] transition-colors text-[13px] cursor-pointer">
              <Image 
                src={"/icons/Icons-03.svg"}
                alt="UK Flag"
                width={20}
                height={20}
              />
              <span className="text-[#4a4a4a] hover:text-[#8cc63f] font-normal">English</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu (visible on screens <= 425px when open) */}
        {isOpen && (
          <div className="absolute top-full left-0 w-full bg-white shadow-md border-t border-gray-100 flex flex-col py-4 px-6 gap-3 z-50 min-[426px]:hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "transition-all duration-200 text-sm py-2 px-4 rounded-[10px] font-normal border-2 text-center w-full block",
                    isActive
                      ? "border-[#8cc63f] text-[#8cc63f] bg-[#8cc63f]/5 font-medium"
                      : "border-transparent text-[#4a4a4a] hover:text-[#8cc63f] hover:bg-[#8cc63f]/5"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
