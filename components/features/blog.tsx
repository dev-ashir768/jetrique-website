"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface BlogPost {
  title: string;
  excerpt: string;
  imageSrc: string;
  alt: string;
}

const posts: BlogPost[] = [
  {
    title: "A Shift in How We Travel",
    excerpt:
      "Travel is no longer just about reaching a destination; it's about the entire journey. Today's traveler values comfort, ease, and meaningful experiences over rushed itineraries and crowded checklists. The focus has shifted from seeing more to experiencing better.",
    imageSrc: "/images/13.jpg",
    alt: "Luxury private jet interior",
  },
  {
    title: "The Rise of Curated Journeys",
    excerpt:
      "Curated travel brings a new level of thoughtfulness to every trip. From seamless transfers to handpicked stays, every detail is planned to remove friction. It's not about over-the-top luxury; it's about creating a smooth, stress-free experience that allows you to fully enjoy the moment.",
    imageSrc: "/images/14.jpg",
    alt: "Curated fine dining experience",
  },
  {
    title: "Destinations That Offer More",
    excerpt:
      "Beyond popular tourist spots, travelers are now drawn to destinations that provide a deeper connection. Quiet mountain escapes, untouched landscapes, and culturally rich locations are becoming the preferred choice. These places offer more than views they offer perspective, calm, and authenticity.",
    imageSrc: "/images/15.jpg",
    alt: "Breathtaking mountain destination",
  },
  {
    title: "Travel Guide",
    excerpt:
      "Travel is no longer just about reaching a destination; it's about the entire journey. Today's traveler values comfort, ease, and meaningful experiences over rushed itineraries and crowded checklists. The focus has shifted from seeing more to experiencing better.",
    imageSrc: "/images/9.jpg",
    alt: "Luxury private jet interior",
  },
];

/**
 * Arrow button — consumes CarouselContext, so it must live inside <Carousel>.
 * className is forwarded so the caller controls positioning.
 */
function BlogArrow({
  direction,
  className,
}: {
  direction: "prev" | "next";
  className?: string;
}) {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } =
    useCarousel();
  const isPrev = direction === "prev";

  return (
    <button
      onClick={isPrev ? scrollPrev : scrollNext}
      disabled={isPrev ? !canScrollPrev : !canScrollNext}
      aria-label={isPrev ? "Previous slide" : "Next slide"}
      className={cn("cursor-pointer shrink-0 hidden md:block", className)}
    >
      <Image
        src="/icons/Icons-02.svg"
        alt=""
        width={25}
        height={25}
        className={cn("select-none", isPrev && "rotate-180")}
      />
    </button>
  );
}

export default function Blog() {
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    api.on("select", handleSelect);
    api.on("reInit", handleSelect);

    const autoplay = setInterval(() => {
      api.scrollNext();
    }, 5000);

    return () => {
      api.off("select", handleSelect);
      api.off("reInit", handleSelect);
      clearInterval(autoplay);
    };
  }, [api]);

  const activeIndex = isDesktop
    ? (currentIndex + 1) % posts.length
    : currentIndex;

  return (
    <section className="w-full bg-white pt-10 md:pt-12 px-4 md:px-8">
      <div className="container">
        {/*
          Carousel wraps BOTH the header and the cards so BlogArrow can
          call useCarousel() from anywhere inside — including the subtitle row.
        */}
        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true, slidesToScroll: 1 }}
          className="w-full"
        >
          {/* ── Section Header ── */}
          <div className="flex flex-col items-center mb-10 md:mb-14">
            <h3 className="text-xl lg:text-2xl font-medium text-neutral-700 tracking-wide">
              Blog
            </h3>
            <div className="w-70 md:w-86 h-[1.5px] bg-[#8cc63f] mt-3" />

            {/* Subtitle row — arrows sit at each end of this line */}
            <div className="relative w-full flex items-center justify-center mt-5">
              <BlogArrow
                direction="prev"
                className="absolute md:left-4 left-0 top-1/2 -translate-y-1/2"
              />
              <p className="text-[12px] md:text-[14px] lg:text-[18px] font-light text-neutral-700 text-center tracking-wide ">
                Redefining Travel: Where Comfort Meets Experience
              </p>
              <BlogArrow
                direction="next"
                className="absolute md:right-4 right-0 top-1/2 -translate-y-1/2"
              />
            </div>
          </div>

          {/* ── Cards ── */}
          <CarouselContent className="ml-0">
            {posts.map((post, index) => {
              const isActive = index === activeIndex;

              return (
                <CarouselItem
                  key={post.title}
                  className="basis-full sm:basis-1/2 md:basis-1/3 pl-0"
                >
                  {/* Inner wrapper: right and left borders on active card (desktop only) */}
                  <div
                    className={cn(
                      "group cursor-pointer flex flex-col h-full px-4 md:px-5 transition-all duration-300 border-0 md:border-l md:border-r",
                      isActive
                        ? "md:border-[#8cc63f]"
                        : "md:border-transparent"
                    )}
                  >
                    {/* Image */}
                    <div className="relative w-full aspect-4/3 overflow-hidden rounded-xs">
                      <Image
                        src={post.imageSrc}
                        alt={post.alt}
                        fill
                        className={cn(
                          "object-cover transition-all duration-700 ease-out group-hover:scale-105",
                          isActive ? "scale-[1.02] opacity-100" : "opacity-80 group-hover:opacity-100"
                        )}
                      />
                    </div>

                    {/* Text */}
                    <div className="mt-4 flex flex-col gap-1.5">
                      <h4
                        className={cn(
                          "text-[12px] lg:text-sm font-semibold leading-snug transition-colors duration-300",
                          isActive ? "text-[#8cc63f]" : "text-neutral-800 group-hover:text-[#8cc63f]"
                        )}
                      >
                        {post.title}
                      </h4>
                      <p
                        className={cn(
                          "text-[12px] lg:text-[15px] leading-relaxed transition-colors duration-300",
                          isActive ? "text-neutral-700" : "text-neutral-500 group-hover:text-neutral-700"
                        )}
                      >
                        {post.excerpt}
                      </p>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
