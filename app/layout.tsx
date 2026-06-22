import type { Metadata } from "next";

import "./globals.css";
import QueryProvider from "@/providers/queryProvider";
import { primaryFont } from "./fonts";





export const metadata: Metadata = {
  title: "Jetrique",
  description: "Jetrique is a premier luxury travel company offering private jet charters, helicopter services, exclusive stays, and curated destinations.",
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
