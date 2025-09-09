"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import React from "react";

interface LogoutButtonProps extends React.ComponentProps<typeof Button> {
  children?: React.ReactNode;
  showIcon?: boolean;
}

export function LogoutButton({ 
  children, 
  showIcon = true, 
  className,
  ...props 
}: LogoutButtonProps) {
  const { dispatch } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      dispatch({ type: "LOGOUT" });
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    // <Button 
    //   onClick={handleLogout} 
    //   className={`flex items-center text-primary border-primary cursor-pointer ${className || ""}`}
    //   {...props}
    // >
      <span className="text-md font-bold cursor-pointer" onClick={handleLogout} >
        {showIcon && <LogOut size={20} className="text-red-500" />}
      </span>
    // </Button>
  
  );
} 