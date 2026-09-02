import type { Metadata } from "next";
import { Bebas_Neue, Chakra_Petch, Geist_Mono, Source_Sans_3 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

const chakra = Chakra_Petch({
  weight: ["400", "500", "600"],
  variable: "--font-label",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Sales CRM",
  description: "AI-powered sales intelligence CRM — research, qualify, and convert leads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bebas.variable} ${sourceSans.variable} ${chakra.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
