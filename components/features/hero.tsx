"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export default function Hero() {
  const features = [
    {
      icon: "/images/3.svg",
      title: "LUXURY REDEFINED",
      description: "Exceptional comfort and world-class service.",
    },
    {
      icon: "/images/4.svg",
      title: "SAFETY FIRST",
      description: "Highest safety standards with certified operators.",
    },
    {
      icon: "/images/5.svg",
      title: "24/7 SUPPORT",
      description: "We're here for you, anytime, anywhere.",
    },
    {
      icon: "/images/6.svg",
      title: "GLOBAL ACCESS",
      description: "Access to multiple destinations worldwide.",
    },
  ];

  return (
    <section className="w-full flex flex-col">
      {/* Hero Banner Section */}
      <div className=" relative w-full aspect-video md:aspect-21/9  overflow-hidden">
        {/* Banner Background Image */}
        <Image
          src="/images/1.jpg"
          alt="Jetrique Experience Helicopter Banner"
          fill
          priority
          
          className="object-contain select-none"
        />

        {/* Text Overlay */}
        {/* <div className="absolute inset-0 flex items-center bg-black/5 md:bg-transparent">
          <div className="container w-full h-full flex flex-col justify-center px-6 md:px-12 lg:px-16">
            <div className="max-w-lg md:max-w-2xl select-none">
              <h1 className="text-[9vw] sm:text-[8vw] md:text-[6.5vw] font-bold text-[#8cc63f] leading-[0.95] tracking-tight drop-shadow-xs font-sans">
                EXPERIENCE
              </h1>
              <h2 className="text-[4vw] sm:text-[3.5vw] md:text-[2.8vw] font-semibold text-[#3a3a3a] leading-tight tracking-[0.05em] mt-1 md:mt-2 font-sans">
                THAT'S UNIQUE
              </h2>
            </div>
          </div>
        </div> */}
      </div>

      {/* Feature Description Bar */}
      <div className="bg-white  md:py-4 ">
        <div className="container grid grid-cols-1 md:grid-cols-4 gap-y-5 md:gap-y-0">
          {features.map((item, index) => (
            <div
              key={item.title}
              className={cn(
                "group flex flex-col items-center text-center px-4 md:px-6 gap-3 transition-transform duration-300 hover:scale-[1.02]",
                // Add vertical border on desktop for first 3 items
                index < 3 ? "md:border-r border-[#8cc63f]" : "",
                // Add horizontal border on mobile for first 3 items
                index < 3 ? "border-b border-[#8cc63f] pb-8 md:border-b-0 md:pb-0" : ""
              )}
            >
              {/* Icon Container */}
              <div className="relative w-14 h-14 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-1">
                <Image
                  src={item.icon}
                  alt={item.title}
                  width={54}
                  height={54}
                  className="object-contain"
                />
              </div>

              {/* Title */}
              <h4 className=" text-[12px] md:text-[12px] lg:text-lg font-normal text-neutral-800 tracking-wider uppercase mt-2">
                {item.title}
              </h4>

              {/* Description */}
              <p className="text-[12px] md:text-[13px] lg:text-[14px] text-neutral-500 leading-relaxed  ">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
