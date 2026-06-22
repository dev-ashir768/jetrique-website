import Hero from "@/components/features/hero";
import Assets from "@/components/features/assets";
import FleetDescription from "@/components/features/fleet";
import Blog from "@/components/features/blog";
import ContactUs from "@/components/features/contact-us";

export default function Home() {
  return (
    <>
      <Hero />
      <Assets />
      <FleetDescription />
      <Blog />
      <ContactUs />
    </>
  );
}
