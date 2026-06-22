"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

interface FleetSlide {
  title: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  alt: string;
}

const fleetSlides: FleetSlide[] = [
  {
    title: "Heli",
    subtitle: "Our fleet",
    description:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer",
    imageSrc: "/images/11.jpg",
    alt: "Jetrique Black Helicopter",
  },
  {
    title: "Jets",
    subtitle: "Luxury Charters",
    description:
      "Experience unmatched efficiency and personalized comfort. Our premium private jets are designed to cater to your executive and luxury travel requirements worldwide.",
    imageSrc: "/images/7.jpg",
    alt: "Jetrique Luxury Private Jet",
  },
  {
    title: "Stays",
    subtitle: "Exclusive Retreats",
    description:
      "Discover private villas, boutique hotels, and glass dome retreats selected for their exceptional locations, design, privacy, and outstanding level of service.",
    imageSrc: "/images/9.jpg",
    alt: "Jetrique Exclusive Stays",
  },
];

// Custom Chevron icon that matches the design (clean white arrow)
// function CarouselArrow({
//   direction,
//   onClick,
// }: {
//   direction: "prev" | "next";
//   onClick?: () => void;
// }) {
//   const isPrev = direction === "prev";

//   return (
//     <button
//       onClick={onClick}
//       aria-label={isPrev ? "Previous slide" : "Next slide"}
//       className={cn(
//         "absolute top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 group",
//         isPrev ? "left-0 lg:left-4" : "right-0 lg:right-4",
//       )}
//     >
//       <div className="relative w-10 h-10  flex items-center justify-center">
//         <Image
//           src="/icons/Icons-02.svg"
//           alt={isPrev ? "Prev" : "Next"}
//           width={25}
//           height={24}
//           className={cn(
//             "select-none transition-transform duration-300 group-hover:scale-105 brightness-0 invert",
//             isPrev && "rotate-180",
//           )}
//         />
//       </div>
//     </button>
//   );
// }

// Internal component to handle current carousel controls and custom arrows
function CarouselImageSection() {
  // const { scrollPrev, scrollNext } = useCarousel();

  return (
    <div className="relative w-full overflow-hidden select-none">
      <CarouselContent className="ml-0">
        {fleetSlides.map((slide, index) => (
          <CarouselItem
            key={index}
            className="pl-0 relative w-full aspect-4/3 lg:aspect-4/3"
          >
            <Image
              src={slide.imageSrc}
              alt={slide.alt}
              fill
              priority={index === 0}
              className="object-cover"
            />
            {/* Vignette */}
            {/* <div className="absolute inset-0 bg-black/10" /> */}
          </CarouselItem>
        ))}
      </CarouselContent>

      {/* Render arrows inside/on the image container only */}
      {/* <CarouselArrow direction="prev" onClick={scrollPrev} />
      <CarouselArrow direction="next" onClick={scrollNext} /> */}
    </div>
  );
}

export default function FleetDescription() {
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    api.on("select", handleSelect);
    api.on("reInit", handleSelect);

    // Defer the initial call to avoid setState in effect warning
    const timer = setTimeout(handleSelect, 0);

    // Autoplay transition slides every 4 seconds
    const autoplay = setInterval(() => {
      api.scrollNext();
    }, 4000);

    return () => {
      api.off("select", handleSelect);
      api.off("reInit", handleSelect);
      clearTimeout(timer);
      clearInterval(autoplay);
    };
  }, [api]);

  const activeSlide = fleetSlides[currentIndex] || fleetSlides[0];

  return (
    <section className="w-full pt-10 md:pt-12 px-4 md:px-8">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* Left Side: Carousel of images */}
          <Carousel
            setApi={setApi}
            opts={{ align: "start", loop: true }}
            className="w-full h-full flex flex-col justify-center"
          >
            <CarouselImageSection />
          </Carousel>

          {/* Right Side: Description card in Brand Green */}
          <div className="bg-[#8cc63f]  p-8 md:p-10 lg:p-12 flex flex-col justify-between text-white min-h-50 `md:min-h-87.5 transition-all duration-500">
            {/* Header and Details */}
            <div className="flex flex-col gap-8">
              <h3 className="text-2xl lg:text-4xl font-normal tracking-wide transition-all duration-300">
                {activeSlide.title}
              </h3>

              <div>
                <h4 className="text-xl lg:text-2xl font-light tracking-wide text-white/90 transition-all duration-300">
                  {activeSlide.subtitle}
                </h4>

                <p className="text-[15px] lg:text-base leading-relaxed font-light text-white/90 mt-2 max-w-lg transition-all duration-300">
                  {activeSlide.description}
                </p>
              </div>
            </div>

            {/* Learn More Button */}
            <div className="mt-4 lg:mt-0 self-start">
              <button className="flex items-center gap-4 bg-white text-neutral-800 hover:bg-neutral-50 px-6 py-2.5 rounded-full text-[14px] font-medium tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs group">
                <span>Learn More</span>
                <span className="text-[#8cc63f] transition-transform duration-300 group-hover:translate-x-1 font-bold">
                  &gt;
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
