import type { Metadata } from 'next';
import Navbar from '@/components/features/navbar';
import Footer from '@/components/features/footer';

export const metadata: Metadata = { title: 'My Account — Jetrique' };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="w-full flex flex-col fixed top-0 z-50">
        <Navbar />
      </header>
      <main className="flex-grow mt-[130px] md:mt-[136px]">{children}</main>
      <footer className="w-full flex flex-col">
        <Footer />
      </footer>
    </div>
  );
}
