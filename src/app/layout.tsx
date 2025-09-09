import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthContextProvider } from "@/context/AuthContext";
import { NavbarWrapper } from "@/components/layout/NavbarWrapper";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata can't be used in client components, so we need to export it separately
export const metadata: Metadata = {
  title: {
    default: "MyClassLog - Student Tracking & Room Exit Management",
    template: "%s | MyClassLog"
  },
  description: "Effortless student tracking and management with powerful tools for room exit monitoring, comprehensive reporting, and classroom organization.",
  keywords: ["student tracking", "classroom management", "attendance", "education", "teacher tools"],
  authors: [{ name: "MyClassLog" }],
  creator: "MyClassLog",

  openGraph: {
    title: "MyClassLog - Student Tracking & Room Exit Management",
    description: "Effortless student tracking and management with powerful tools for room exit monitoring, comprehensive reporting, and classroom organization.",
    type: "website",
    locale: "en_US",
    siteName: "MyClassLog",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyClassLog - Student Tracking & Room Exit Management",
    description: "Effortless student tracking and management with powerful tools for room exit monitoring, comprehensive reporting, and classroom organization.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthContextProvider>
          <NavbarWrapper>
            {children}
          </NavbarWrapper>
          <Toaster />
        </AuthContextProvider>
      </body>
    </html>
  );
}
