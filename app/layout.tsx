import type { Metadata } from "next";

import "./globals.css";
import QueryProvider from "@/providers/queryProvider";
import { primaryFont } from "./fonts";


export const metadata: Metadata = {
  title: "Jetrique — Private Aviation",
  description: "Book private aviation flights, helicopter charters, and exclusive stays with Jetrique.",
  openGraph: {
    title: "Jetrique — Private Aviation",
    description: "Book private aviation flights, helicopter charters, and exclusive stays with Jetrique.",
    type: "website",
    siteName: "Jetrique",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jetrique — Private Aviation",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={` ${primaryFont.className} antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
