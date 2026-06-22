"use client";

import React from "react";
import Image from "next/image";


interface AssetCard {
  title: string;
  imageSrc: string;
  alt: string;
}

export default function Assets() {
  const assets: AssetCard[] = [
    {
      title: "JETS",
      imageSrc: "/images/7.jpg",
      alt: "Jetrique Luxury Jets",
    },
    {
      title: "HELI",
      imageSrc: "/images/8.jpg",
      alt: "Jetrique Helicopter Charters",
    },
    {
      title: "STAYS",
      imageSrc: "/images/9.jpg",
      alt: "Jetrique Exclusive Stays",
    },
    {
      title: "DESTINATION",
      imageSrc: "/images/10.jpg",
      alt: "Jetrique Travel Destinations",
    },
  ];

  return (
    <section className="w-full bg-white pt-10 md:pt-12 px-4 md:px-8">
      <div className="container">
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 md:gap-0">
          {assets.map((asset, index) => (
            <React.Fragment key={asset.title}>
              {/* Main Card Content */}
              <div className="flex-1 flex flex-col group cursor-pointer w-full">
                {/* Image Wrapper */}
                <div className="relative w-full aspect-3/4 overflow-hidden transition-all duration-500 ease-out">
                  <Image
                    src={asset.imageSrc}
                    alt={asset.alt}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  {/* Subtle vignette/overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
                </div>
                
                {/* Text Label */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[15px] lg:text-md font-semibold tracking-widest text-[#707070] transition-colors duration-300 group-hover:text-[#8cc63f]">
                    {asset.title}
                  </span>
                  
                  {/* Small animated arrow on hover */}
                  <span className="text-[#8cc63f] translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 font-bold text-lg select-none">
                    →
                  </span>
                </div>
              </div>

              {/* Custom Separator (shown on desktop between cards) */}
              {index < assets.length - 1 && (
                <div className="hidden md:flex items-center justify-center w-8 lg:w-12 select-none pointer-events-none">
                  <div className="relative h-70 w-0.75 bg-[#8cc63f]/60 flex items-center justify-center">
                    <div className="absolute w-1.5 h-40 bg-[#8cc63f]  shadow-[0_0_8px_rgba(140,198,63,0.3)]" />
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
