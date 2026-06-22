"use client";

import React from "react";
import Image from "next/image";

interface AboutSection {
  title: string;
  paragraphs: string[];
  imageSrc: string;
  imageAlt: string;
  imageLeftOnDesktop?: boolean;
}

const aboutSections: AboutSection[] = [
  {
    title: "About Us",
    paragraphs: [
      "Jetrique is an integrated luxury travel platform designed for those who value time, discretion, and exceptional access. It brings together private aviation, handpicked destinations, and bespoke hospitality to create journeys that feel effortless from start to finish.",
      "From secluded landscapes to iconic locations, every experience is curated with precision; where access is privileged, and every detail is intentional."
    ],
    imageSrc: "/images/7.jpg",
    imageAlt: "Jetrique luxury jet propeller plane on runway",
  },
  {
    title: "Our Mission",
    paragraphs: [
      "To set a new standard in luxury travel through seamlessly designed journeys that combine private air access, curated destinations, and personalized hospitality.",
      "Every experience is crafted with care; where comfort is uncompromised, transitions are seamless, and each journey is defined by thoughtful detail and refined execution."
    ],
    imageSrc: "/images/14.jpg",
    imageAlt: "Jetrique luxury swimming pool retreat overlooking the forest",
    imageLeftOnDesktop: true,
  },
  {
    title: "Our Vision",
    paragraphs: [
      "To be recognized as a leading name in luxury travel, known for redefining how exclusive journeys are experienced; where access, ease, and elevated experiences come together to shape a new way of exploring the world."
    ],
    imageSrc: "/images/13.jpg",
    imageAlt: "Jetrique luxury glass conference room with city view",
  },
];

export default function AboutUs() {
  return (
    <section className="w-full bg-white py-16 md:py-24 px-4 md:px-8 2xl:pt-30 2xl:pb-10">
      <div className="container">
        <div className="flex flex-col gap-20 md:gap-28 lg:gap-32">
          {aboutSections.map((section) => {
            return (
              <div
                key={section.title}
                className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-24 items-center"
              >
                {/* Text Block */}
                <div
                  className={`flex flex-col ${
                    section.imageLeftOnDesktop
                      ? "order-1 md:order-2"
                      : "order-1"
                  }`}
                >
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-wide text-neutral-800">
                    {section.title}
                  </h2>
                  
                  {/* brand-green underline separator */}
                  <div className="w-75 md:w-80 lg:w-130 h-0.75 bg-[#8cc63f] mt-4" />

                  <div className="flex flex-col gap-5 mt-8">
                    {section.paragraphs.map((para, pIndex) => (
                      <p
                        key={pIndex}
                        className="text-[14px] md:text-[15px] lg:text-[16px] text-neutral-500 font-light leading-relaxed tracking-wide"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Image Block */}
                <div
                  className={`relative w-full aspect-4/3 overflow-hidden group ${
                    section.imageLeftOnDesktop
                      ? "order-2 md:order-1"
                      : "order-2"
                  }`}
                >
                  <Image
                    src={section.imageSrc}
                    alt={section.imageAlt}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
