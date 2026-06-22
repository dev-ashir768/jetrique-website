"use client";

import Image from "next/image";

export default function Footer() {
  return (
    <>
      {/* Footer Content Area */}
      <div className="bg-white pt-10 pb-8 flex flex-col items-center">
        {/* Get in Touch Heading */}
        <div className="flex flex-col items-center mb-8">
          <h3 className="text-xl md:text-2xl font-medium text-neutral-700 tracking-wide">
            Get in Touch
          </h3>
          <div className="w-70 md:w-90 h-[1.5px] bg-[#8cc63f] mt-3" />
        </div>

        {/* Contact Info Row */}
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-14 text-sm md:text-[15px] font-medium text-[#4a4a4a] px-4">
          {/* Phone */}
          <a
            href="tel:02134581771"
            className="flex items-center gap-2 hover:text-[#8cc63f] transition-colors duration-200"
          >
            <Image
              src="/images/Footer Icon-01.svg"
              alt="Phone Icon"
              width={20}
              height={20}
              className="h-5 w-auto object-contain"
            />
            <span>(021) 34581771</span>
          </a>

          {/* Email */}
          <a
            href="mailto:hello@jetrique.com"
            className="flex items-center gap-2 hover:text-[#8cc63f] transition-colors duration-200"
          >
            <Image
              src="/images/Footer Icon-02.svg"
              alt="Email Icon"
              width={20}
              height={20}
              className="h-5 w-auto object-contain"
            />
            <span>hello@jetrique.com</span>
          </a>

          {/* Address */}
          <div className="flex items-center gap-2">
            <Image
              src="/images/Footer Icon-03.svg"
              alt="Address Icon"
              width={20}
              height={20}
              className="h-5 w-auto shrink-0 object-contain"
            />
            <span className="text-center leading-snug max-w-75 md:max-w-full">
              Suite #4, Airport Commercial Zone, Jinnah International Airport, Karachi, Pakistan
            </span>
          </div>
        </div>
      </div>

      {/* Dark Charcoal Separator Bar */}
      <div className="w-full h-3.5 bg-[#3a3a3a]" />

      {/* Bottom Brand-Green Banner */}
      <div className="w-full bg-[#8cc63f] py-2 md:py-4" />
    </>
  );
}
