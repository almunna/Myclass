"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAuth } from "@/hooks/useAuth";
import DashboardIcon from "./icons/Dashboard.jpeg";
import PeriodsIcon from "./icons/Periods.jpeg";
import StudentsIcon from "./icons/Students.jpeg";
import AttendanceIcon from "./icons/Attendance.jpeg";
import PlansIcon from "./icons/Plans.jpeg";
import TrackingIcon from "./icons/Tracking.jpeg";
import ReportsIcon from "./icons/Reports.png";
import SeatingIcon from "./icons/Seating.jpeg";
import TutorialsIcon from "./icons/Tutorials.jpeg";
import AccountIcon from "./icons/Account.jpeg";

import {
  Menu,
  X,
  User,
  BarChart,
  Users,
  BookOpen,
  CreditCard,
  Clock,
  UserCircle,
  GraduationCap,
  LayoutGrid,
  Check,
  CalendarDays, // ✅ added
} from "lucide-react";

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

    // ✅ Close mobile menu when resizing to desktop (lg and up)
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsNavOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Define nav links
  const navLinks = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: (
        <Image src={DashboardIcon} alt="Dashboard" width={20} height={20} />
      ),
    },
    {
      name: "Periods",
      href: "/periods",
      icon: <Image src={PeriodsIcon} alt="Periods" width={20} height={20} />,
    },
    {
      name: "Students",
      href: "/students",
      icon: <Image src={StudentsIcon} alt="Students" width={20} height={20} />,
    },
    {
      name: "Attendance",
      href: "/attendance",
      icon: (
        <Image src={AttendanceIcon} alt="Attendance" width={20} height={20} />
      ),
    },
    {
      name: "Plans",
      href: "/plans",
      icon: <Image src={PlansIcon} alt="Plans" width={20} height={20} />,
    },
    {
      name: "Tracking",
      href: "/tracking",
      icon: <Image src={TrackingIcon} alt="Tracking" width={20} height={20} />,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: <Image src={ReportsIcon} alt="Reports" width={20} height={20} />,
    },
    {
      name: "Seating",
      href: "/class-layout",
      icon: <Image src={SeatingIcon} alt="Seating" width={20} height={20} />,
    },
    {
      name: "Tutorials",
      href: "/tutorials",
      icon: (
        <Image src={TutorialsIcon} alt="Tutorials" width={20} height={20} />
      ),
    },
    {
      name: "Account",
      href: "/subscription",
      icon: <Image src={AccountIcon} alt="Account" width={20} height={20} />,
    },
  ];

  // Don't render content until mounted (client-side only)
  if (!isMounted) {
    return <header className="h-20" />;
  }

  // Extract first name from user's display name or email
  const getFirstName = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName.split(" ")[0];
    }
    if (currentUser?.email) {
      return currentUser.email.split("@")[0];
    }
    return "User";
  };

  // If not logged in, only Tutorials should be publicly accessible.
  // Others redirect to login with redirect=<original href>
  const effectiveHref = (href: string) => {
    if (href === "/tutorials") return "/tutorials";
    if (currentUser) return href;
    return `/login?redirect=${encodeURIComponent(href)}`; // ✅ changed from returnTo → redirect
  };

  return (
    <header
      className={`fixed top-0 w-full z-40 transition-all duration-200 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-md shadow-sm"
          : "bg-background"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 md:py-4 min-h-[80px]">
          {/* Logo */}
          <div className="flex items-center ml-3">
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

          {/* Desktop Navigation (now lg and up) */}
          <nav className="hidden lg:flex flex-1 items-center justify-center gap-4 xl:gap-6 min-w-0 overflow-x-auto">
            <>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={effectiveHref(link.href)}
                  className={`flex items-center gap-1.5 hover:text-primary transition-colors ${
                    pathname === link.href
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              ))}
            </>
          </nav>

          {/* Auth Buttons or User Menu (now lg and up) */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            {currentUser ? (
              <>
                <span className="text-sm font-bold">{getFirstName()}</span>
                <LogoutButton
                  variant="outline"
                  size="sm"
                  showIcon={true}
                ></LogoutButton>
              </>
            ) : (
              <>
                {/* ✅ pass ?redirect=<current path> */}
                <Link
                  href={`/login?redirect=${encodeURIComponent(
                    pathname || "/"
                  )}`}
                >
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link
                  href={`/signup?redirect=${encodeURIComponent(
                    pathname || "/"
                  )}`}
                >
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile/Tablet Menu Button (visible below lg) */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsNavOpen(!isNavOpen)}
            aria-label="Toggle menu"
          >
            {isNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Navigation (below lg) */}
      {isNavOpen && (
        <nav className="lg:hidden p-4 bg-background border-t">
          <div className="flex flex-col space-y-4">
            <>
              {currentUser && (
                <div className="pb-2 border-b">
                  <span className="text-sm font-medium text-muted-foreground">
                    Hello, {getFirstName()}
                  </span>
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={effectiveHref(link.href)}
                  className={`flex items-center gap-2 py-2 ${
                    pathname === link.href
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setIsNavOpen(false)}
                >
                  {link.icon}
                  {link.name}
                </Link>
              ))}

              <div className="pt-4 border-t">
                {currentUser ? (
                  <LogoutButton
                    className="w-full justify-center"
                    variant="destructive"
                    showIcon={true}
                  >
                    Sign Out
                  </LogoutButton>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* ✅ pass ?redirect=<current path> on mobile too */}
                    <Link
                      href={`/login?redirect=${encodeURIComponent(
                        pathname || "/"
                      )}`}
                      onClick={() => setIsNavOpen(false)}
                    >
                      <Button
                        variant="outline"
                        className="w-full justify-center"
                      >
                        Log in
                      </Button>
                    </Link>
                    <Link
                      href={`/signup?redirect=${encodeURIComponent(
                        pathname || "/"
                      )}`}
                      onClick={() => setIsNavOpen(false)}
                    >
                      <Button className="w-full justify-center">Sign up</Button>
                    </Link>
                  </div>
                )}
              </div>
            </>
          </div>
        </nav>
      )}
    </header>
  );
}
