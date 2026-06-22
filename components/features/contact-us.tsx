"use client";

import Image from "next/image";

import { motion } from "framer-motion";

export default function ContactUs() {
  const logos = [
    { src: "/images/16.png", alt: "Aviation Awards" },
    { src: "/images/17.png", alt: "IS-BAH" },
    { src: "/images/18.png", alt: "World Travel Awards 1" },
    { src: "/images/19.png", alt: "World Travel Awards 2" },
    { src: "/images/20.png", alt: "World Travel Awards 3" },
    { src: "/images/21.png", alt: "Safety 1st" },
    { src: "/images/22.png", alt: "Safety 1st Clean" },
    { src: "/images/23.png", alt: "IATA Strategic Partner" },
  ];

  return (
    <section className="w-full bg-white pt-10 md:pt-20">
      <div>
        {/* Floating Ticker Logo Bar (Using Framer Motion) */}
        <div className="relative w-full overflow-hidden mb-12 md:mb-16 py-2">
          {/* Edge Gradients for Smooth Fade Effect */}
          <div className="absolute left-0 top-0 bottom-0 w-16 md:w-28 bg-linear-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 md:w-28 bg-linear-to-l from-white to-transparent z-10 pointer-events-none" />

          <motion.div
            className="flex gap-12 md:gap-16 items-center w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: 25,
            }}
          >
            {/* Duplicated list for seamless looping */}
            {[...logos, ...logos].map((logo, index) => (
              <div
                key={index}
                className="transition-transform duration-300 hover:scale-105 shrink-0 px-2"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={160}
                  height={75}
                  className="h-12 md:h-18 w-auto object-contain select-none"
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Contact Us Details */}
        <div className="container px-4 flex flex-col items-center">
          <h3 className="text-xl md:text-2xl font-medium text-neutral-700 tracking-wide">
            Contact Us
          </h3>
          <div className="w-70 md:w-90 h-[1.5px] bg-[#8cc63f] mt-3" />
          
          <p className="text-center text-[15px] lg:text-lg text-neutral-500 leading-relaxed max-w-6xl mt-6 px-4">
            Whether you&apos;re planning your next journey or simply exploring what&apos;s possible, 
            our team is here to assist. Reach out to begin a conversation; every detail will 
            be handled with care, discretion, and a commitment to making your experience 
            seamless from the very first interaction.
          </p>
        </div>
      </div>
    </section>
  );
}
