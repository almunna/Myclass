"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

interface NavbarWrapperProps {
  children: React.ReactNode;
}

export function NavbarWrapper({ children }: NavbarWrapperProps) {
  const pathname = usePathname();
  const isAuthPage = pathname?.includes("/login") || pathname?.includes("/signup");
  const showNavbarAndFooter = !isAuthPage;


  return (
    <div className="flex flex-col min-h-svh">
      {showNavbarAndFooter && <Navbar />}
      <main className={`flex-grow ${showNavbarAndFooter ? "pt-20" : ""}`}>
        {children}
      </main>
      {/* {showNavbarAndFooter && <Footer />} */}
    </div>
  );
} 