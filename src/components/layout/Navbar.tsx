"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, User, BarChart, Users, BookOpen, CreditCard, Clock, UserCircle, GraduationCap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandImage from "../../../public/MyClassLog.jpg";

export function Navbar() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Only run client-side effects after component is mounted
  useEffect(() => {
    setIsMounted(true);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Define nav links
  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: <User size={18} /> },
    { name: "Periods", href: "/periods", icon: <BookOpen size={18} /> },
    { name: "Students", href: "/students", icon: <Users size={18} /> },
    { name: "Attendance", href: "/attendance", icon: <Check size={18} /> },
    { name: "Tracking", href: "/tracking", icon: <Clock size={18} /> },
    { name: "Reports", href: "/reports", icon: <BarChart size={18} /> },
    { name: "Subscription", href: "/subscription", icon: <CreditCard size={18} /> },
  ];

  // Don't render content until mounted (client-side only)
  if (!isMounted) {
    return <header className="h-20" />;
  }

  // Extract first name from user's display name or email
  const getFirstName = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName.split(' ')[0];
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'User';
  };

  return (
    <header
      className={`fixed top-0 w-full z-40 transition-all duration-200 ${isScrolled ? "bg-background/90 backdrop-blur-md shadow-sm" : "bg-background"
        }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24">

          {/* Logo */}
          <div className="flex items-center">

            <Link
              href="/"
              className="text-xl font-semibold flex items-center gap-2"
            >
              <div className="flex items-center gap-2">
                  <Image 
                    src={BrandImage} 
                    alt="My Class Log Logo" 
                    width={100} 
                    height={80} 
                    className="rounded"
                    priority
                  />
                {/* <span className="text-primary font-bold tracking-tight">My Class Log</span> */}
              </div>
            </Link>
          </div>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {currentUser ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 hover:text-primary transition-colors ${pathname === link.href ? "text-primary font-medium" : "text-muted-foreground"
                      }`}
                  >
                    {link.icon}
                    {link.name}
                  </Link>
                ))}
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className={`hover:text-primary transition-colors ${pathname === "/" ? "text-primary font-medium" : "text-muted-foreground"
                    }`}
                >
                  Home
                </Link>
                <Link
                  href="/about"
                  className={`hover:text-primary transition-colors ${pathname === "/about" ? "text-primary font-medium" : "text-muted-foreground"
                    }`}
                >
                  About
                </Link>
                <Link
                  href="/pricing"
                  className={`hover:text-primary transition-colors ${pathname === "/pricing" ? "text-primary font-medium" : "text-muted-foreground"
                    }`}
                >
                  Pricing
                </Link>
              </>
            )}
          </nav>

          {/* Auth Buttons or User Menu */}
          <div className="hidden md:flex items-center gap-1">
            {currentUser ? (
              <>
                <span className="text-sm font-bold">
                  {getFirstName()}
                </span>
                <LogoutButton variant="outline" size="sm" showIcon={true}></LogoutButton> 
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsNavOpen(!isNavOpen)}
            aria-label="Toggle menu"
          >
            {isNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isNavOpen && (
        <nav className="md:hidden p-4 bg-background border-t">
          <div className="flex flex-col space-y-4">
            {currentUser ? (
              <>
                <div className="pb-2 border-b">
                  <span className="text-sm font-medium text-muted-foreground">
                    Hello, {getFirstName()}
                  </span>
                </div>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 py-2 ${pathname === link.href ? "text-primary font-medium" : "text-muted-foreground"
                      }`}
                    onClick={() => setIsNavOpen(false)}
                  >
                    {link.icon}
                    {link.name}
                  </Link>
                ))}
                <div className="pt-4 border-t">
                  <LogoutButton
                    className="w-full justify-center"
                    variant="destructive"
                    showIcon={true}
                  >
                    Sign Out
                  </LogoutButton>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className="py-2"
                  onClick={() => setIsNavOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/about"
                  className="py-2"
                  onClick={() => setIsNavOpen(false)}
                >
                  About
                </Link>
                <Link
                  href="/pricing"
                  className="py-2"
                  onClick={() => setIsNavOpen(false)}
                >
                  Pricing
                </Link>
                <div className="flex flex-col gap-2 pt-4 border-t">
                  <Link href="/login" onClick={() => setIsNavOpen(false)}>
                    <Button variant="outline" className="w-full justify-center">Log in</Button>
                  </Link>
                  <Link href="/signup" onClick={() => setIsNavOpen(false)}>
                    <Button className="w-full justify-center">Sign up</Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
} 