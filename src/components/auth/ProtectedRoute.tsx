"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser } = useContext(AuthContext);
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    if (!currentUser) {
      router.push("/login");
    }
  }, [currentUser, router]);

  // Don't render anything during SSR or until client hydration is complete
  if (!isClient) {
    return null;
  }

  // Don't render children if not authenticated
  if (!currentUser) {
    return null;
  }

  return <>{children}</>;
} 