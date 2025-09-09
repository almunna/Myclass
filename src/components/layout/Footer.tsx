"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export function Footer() {
  const { currentUser } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Product */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Student Tracker</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Track student room exits easily and generate insightful reports.
            </p>
            <p className="text-muted-foreground text-sm">
              © {currentYear} StudentTracker. All rights reserved.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {currentUser ? (
                <>
                  <li>
                    <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/periods" className="text-muted-foreground hover:text-primary transition-colors">
                      Periods
                    </Link>
                  </li>
                  <li>
                    <Link href="/students" className="text-muted-foreground hover:text-primary transition-colors">
                      Students
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports" className="text-muted-foreground hover:text-primary transition-colors">
                      Reports
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="text-muted-foreground hover:text-primary transition-colors">
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="text-muted-foreground hover:text-primary transition-colors">
                      Sign Up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-3">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/help" className="text-muted-foreground hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              {currentUser && (
                <li>
                  <Link href="/subscription" className="text-muted-foreground hover:text-primary transition-colors">
                    Subscription
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
} 