import React from "react";
import Navbar from "@/components/features/navbar";
import Footer from "@/components/features/footer";

export default function HomeGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50/10">
      <header className="w-full flex flex-col fixed top-0 z-50">
        <Navbar />
      </header>
      
      <main className="grow mt-25 md:mt-25 2xl:mt-14">
        {children}
      </main>

      <footer className="w-full flex flex-col">
        <Footer />
      </footer>
    </div>
  );
}
