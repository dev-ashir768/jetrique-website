"use client";

import React from "react";
import Image from "next/image";

interface Product {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
  duration: string;
}

const products: Product[] = [
  {
    id: "skardu-ascend",
    title: "SKARDU ASCEND",
    description: "An elevated helicopter experience above Skardu's breathtaking terrain crafted around perspective, privacy, and seamless luxury.",
    imageSrc: "/products/1.jpg",
    duration: "20-min",
  },
  {
    id: "skardu-airborne",
    title: "SKARDU AIRBORNE",
    description: "Skardu from above, an experience through the quiet exclusivity of a private jet.",
    imageSrc: "/products/2.jpg",
    duration: "45-min",
  },
  {
    id: "beyond-deosai",
    title: "BEYOND DEOSAI",
    description: "A cinematic aerial expedition across Deosai and the Cold Desert, crafted for those drawn to rare landscapes and elevated experiences.",
    imageSrc: "/products/3.jpg",
    duration: "1-Hrs",
  },
  {
    id: "northbound",
    title: "NORTHBOUND",
    description: "A more refined way to travel between Islamabad and Skardu through private aviation tailored entirely around your schedule.",
    imageSrc: "/products/4.jpg",
    duration: "2-Hrs",
  },
];

const ClockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#8cc63f"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6 shrink-0"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default function OurProducts() {
  return (
    <section className="w-full bg-white pt-18 pb-5 md:py-20 2xl:pt-30 2xl:pb-5">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-x-12 md:gap-y-16 lg:gap-x-16 lg:gap-y-0 items-stretch">
          {products.map((product, index) => (
            <div key={product.id} className="relative flex flex-col justify-between group cursor-pointer w-full">
              {/* Card Contents */}
              <div className="flex flex-col h-full justify-between">
                {/* Top Section */}
                <div className="flex flex-col">
                  {/* Image Wrapper */}
                  <div className="relative w-full aspect-4/5 overflow-hidden ">
                    <Image
                      src={product.imageSrc}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg lg:text-xl font-bold tracking-wider text-neutral-700 mt-6 uppercase leading-tight transition-colors duration-300 group-hover:text-[#8cc63f]">
                    {product.title}
                  </h3>

                  {/* Description */}
                  <p className="text-[10px] md:text-[13px] text-neutral-500 mt-1 leading-relaxed">
                    <span className="font-semibold text-neutral-700">Description:</span>{" "}
                    {product.description}
                  </p>
                </div>

                {/* Bottom Action Section */}
                <div className="mt-3 flex items-center justify-between border-t border-[#8cc63f] pt-3">
                  <button className="bg-[#8cc63f] hover:bg-[#8cc63f]/90 text-white rounded-full px-5 py-2.5 text-[13px] font-semibold flex items-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs group/btn">
                    <span>Book Now</span>
                    <span className="font-bold transition-transform duration-200 group-hover/btn:translate-x-0.5">&gt;</span>
                  </button>

                  <div className="flex items-center gap-2 text-[#3a3a3a] font-bold text-[12px]">
                    <ClockIcon />
                    <span>{product.duration}</span>
                  </div>
                </div>
              </div>

              {/* Custom Separators using absolute position in grid gaps */}
              {/* Desktop Separator (lg: 4 columns) - shown on right of first 3 cards */}
              {index < 3 && (
                <div className="hidden lg:flex absolute -right-6 lg:-right-8 top-1/2 -translate-y-1/2 h-80 w-0.75 bg-[#8cc63f]/60 items-center justify-center select-none pointer-events-none">
                  {/* <div className="w-1.5 h-48 bg-[#8cc63f] shadow-[0_0_8px_rgba(140,198,63,0.3)]" /> */}
                </div>
              )}

              {/* Tablet Separator (md: 2 columns, lg: hidden) - shown on right of card 0 and 2 */}
              {(index === 0 || index === 2) && (
                <div className="hidden md:flex lg:hidden absolute -right-6 top-1/2 -translate-y-1/2 h-64 w-0.5 bg-[#a2e748]/30 items-center justify-center select-none pointer-events-none">
                  <div className="w-1 h-36 bg-[#8cc63f]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
