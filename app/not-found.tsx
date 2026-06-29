import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-6xl font-bold text-neutral-800">404</h1>
      <h2 className="text-2xl font-semibold text-neutral-700">Page not found</h2>
      <p className="text-neutral-500">The page you are looking for does not exist.</p>
      <Link href="/" className="text-[#8cc63f] underline">Go to homepage</Link>
    </div>
  );
}
