"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ContactInfoItem {
  iconSrc: string;
  title: string;
  value: string;
  linkHref?: string;
  subValue?: string;
}

const contactInfoItems: ContactInfoItem[] = [
  {
    iconSrc: "/images/Footer Icon-01.svg",
    title: "Call Us",
    value: "(021) 34581771",
    subValue: "Direct Charter Line",
    linkHref: "tel:02134581771",
  },
  {
    iconSrc: "/images/Footer Icon-02.svg",
    title: "Email Us",
    value: "hello@jetrique.com",
    subValue: "charters@jetrique.com",
    linkHref: "mailto:hello@jetrique.com",
  },
  {
    iconSrc: "/images/Footer Icon-03.svg",
    title: "Headquarters",
    value: "Suite #4, Airport Commercial Zone",
    subValue: "Jinnah International Airport, Karachi, Pakistan",
  },
];

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters long"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function ContactDetails() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = (data: ContactFormData) => {
    // Simulate API request submission
    console.log(data);
    setFormSubmitted(true);
    reset();
  };

  return (
    <section className="w-full bg-neutral-50/30 py-16 md:py-20 px-4 md:px-8 2xl:pt-30 2xl:pb-10">
      {/* 
        Responsive container matching consistent horizontal alignment.
        Using both general container class and custom responsive padding as instructed.
      */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="flex flex-col items-center text-center mb-16 md:mb-20">
          {/* <span className="text-[12px] md:text-[13px] font-bold text-[#8cc63f] tracking-[0.2em] uppercase">
            Get In Touch
          </span> */}
          <h1 className="text-2xl md:text-4xl font-semibold text-neutral-800 tracking-wide mt-3">
            Contact Jetrique
          </h1>
          <div className="w-56 h-0.75 bg-[#8cc63f] mt-4" />
          <p className="text-neutral-500 font-light text-[14px] md:text-[16px] max-w-2xl mt-6 leading-relaxed">
            Whether planning your next private jet charter, helicopter trip, or selecting exclusive stays, 
            our team is ready to curate your experience. Reach out below to begin your journey.
          </p>
        </div>

        {/* Contact Page Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Contact Form Area (lg: 7 Cols) */}
          <div className="lg:col-span-7 bg-white p-8 md:p-10  border border-neutral-100 flex flex-col justify-between">
            <h2 className="text-xl md:text-2xl font-semibold text-neutral-800 tracking-wide mb-6">
              Send Us a Message
            </h2>

            {formSubmitted ? (
              <div className="bg-[#8cc63f]/10 border border-[#8cc63f]/30 p-6  text-center my-6">
                <h3 className="text-lg font-bold text-neutral-800">Thank You!</h3>
                <p className="text-[14px] text-neutral-600 mt-2">
                  Your message has been received successfully. A Jetrique Luxury Travel Consultant will contact you shortly.
                </p>
                <button
                  onClick={() => setFormSubmitted(false)}
                  className="mt-4 text-[13px] font-semibold text-[#8cc63f] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name field */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="text-[12px] font-bold text-neutral-600 uppercase tracking-wider">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      {...register("name")}
                      placeholder="e.g. John Doe"
                      className="w-full bg-neutral-50/50 border border-neutral-200 rounded-[8px] px-4 py-3 text-[14px] text-neutral-800 focus:outline-none focus:border-[#8cc63f] focus:ring-1 focus:ring-[#8cc63f] transition-all"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Email field */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-[12px] font-bold text-neutral-600 uppercase tracking-wider">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      {...register("email")}
                      placeholder="e.g. john@example.com"
                      className="w-full bg-neutral-50/50 border border-neutral-200 rounded-[8px] px-4 py-3 text-[14px] text-neutral-800 focus:outline-none focus:border-[#8cc63f] focus:ring-1 focus:ring-[#8cc63f] transition-all"
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                {/* Subject field */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="subject" className="text-[12px] font-bold text-neutral-600 uppercase tracking-wider">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    {...register("subject")}
                    placeholder="e.g. Charter Booking Inquiries"
                    className="w-full bg-neutral-50/50 border border-neutral-200 rounded-[8px] px-4 py-3 text-[14px] text-neutral-800 focus:outline-none focus:border-[#8cc63f] focus:ring-1 focus:ring-[#8cc63f] transition-all"
                  />
                  {errors.subject && (
                    <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>
                  )}
                </div>

                {/* Message field */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="message" className="text-[12px] font-bold text-neutral-600 uppercase tracking-wider">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    {...register("message")}
                    placeholder="Tell us about your flight requirements, schedule, or preferred stays..."
                    className="w-full bg-neutral-50/50 border border-neutral-200 rounded-[8px] px-4 py-3 text-[14px] text-neutral-800 focus:outline-none focus:border-[#8cc63f] focus:ring-1 focus:ring-[#8cc63f] transition-all resize-none"
                  />
                  {errors.message && (
                    <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="mt-2">
                  <button
                    type="submit"
                    className="bg-[#8cc63f] hover:bg-[#8cc63f]/90 text-white rounded-full px-8 py-3.5 text-[14px] font-semibold flex items-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md group/btn"
                  >
                    <span>Send Message</span>
                    <span className="font-bold transition-transform duration-200 group-hover/btn:translate-x-0.5">&gt;</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Contact Details Cards & Map Mockup (lg: 5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            
            {/* Info Cards Grid */}
            <div className="flex flex-col gap-6">
              {contactInfoItems.map((item, index) => {
                const isLink = !!item.linkHref;
                const cardContent = (
                  <>
                    {/* Icon container with border separator */}
                    <div className="relative h-12 w-12 shrink-0 rounded-full bg-[#8cc63f]/10 flex items-center justify-center">
                      <Image
                        src={item.iconSrc}
                        alt={item.title}
                        width={22}
                        height={22}
                        className="h-5 w-5 object-contain"
                      />
                    </div>

                    {/* Text Details */}
                    <div className="flex flex-col gap-1">
                      <h4 className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider">
                        {item.title}
                      </h4>
                      <p className="text-[15px] font-medium text-neutral-800 transition-colors group-hover:text-[#8cc63f] leading-snug">
                        {item.value}
                      </p>
                      {item.subValue && (
                        <p className="text-[13px] text-neutral-500 font-light leading-snug">
                          {item.subValue}
                        </p>
                      )}
                    </div>
                  </>
                );

                if (isLink) {
                  return (
                    <a
                      key={index}
                      href={item.linkHref}
                      className="group flex gap-5 bg-white p-6  border border-neutral-100 transition-all duration-300 hover:border-[#8cc63f]/40 hover:-translate-y-0.5 cursor-pointer"
                    >
                      {cardContent}
                    </a>
                  );
                }

                return (
                  <div
                    key={index}
                    className="flex gap-5 bg-white p-6  border border-neutral-100"
                  >
                    {cardContent}
                  </div>
                );
              })}
            </div>

            {/* Map Mockup container */}
            <div className="relative w-full aspect-16/10  overflow-hidden group  border border-neutral-200 bg-neutral-100">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d28951.34318210342!2d67.168103!3d24.900782!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3eb339c72ec76665%3A0xec5d1d821453c988!2sJinnah%20International%20Airport!5e0!3m2!1sen!2sus!4v1781004345667!5m2!1sen!2sus"
                className="w-full h-full border-0"
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
