"use client";

import { createContext, useReducer, useEffect, ReactNode } from "react";
import AuthReducer from "@/context/AuthReducer";
import Cookies from "js-cookie";
import { getUserSubscription } from "@/lib/db/users";

interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  hasActiveSubscription?: boolean;
  subscriptionPlan?: 'free' | 'basic' | 'premium' | 'admin';
  // Add other user properties as needed
}

interface AuthState {
  currentUser: User | null;
}

interface AuthContextType {
  currentUser: User | null;
  dispatch: React.Dispatch<any>;
}

// Get initial user state from localStorage or cookies for client-side
const getInitialUserState = () => {
  if (typeof window !== 'undefined') {
    // Try to get from localStorage first
    const localUser = localStorage.getItem("user");
    if (localUser) return JSON.parse(localUser);
    
    // Then try cookies
    const cookieUser = Cookies.get("user");
    if (cookieUser) return JSON.parse(cookieUser);
  }
  
  return null;
};

const INITIAL_STATE: AuthState = {
  currentUser: getInitialUserState(),
};

export const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  dispatch: () => {},
});

interface AuthContextProviderProps {
  children: ReactNode;
}

export const AuthContextProvider = ({ children }: AuthContextProviderProps) => {
  const [state, dispatch] = useReducer(AuthReducer, INITIAL_STATE);

  // Check subscription status when user changes
  useEffect(() => {
    const checkSubscription = async () => {
      if (state.currentUser?.uid) {
        const subscription = await getUserSubscription(state.currentUser.uid);
        const hasActiveSubscription = subscription?.subscriptionStatus === 'active';
        const subscriptionPlan = subscription?.subscriptionPlan || 'free';
        
        // Update user with subscription status
        const updatedUser = {
          ...state.currentUser,
          hasActiveSubscription,
          subscriptionPlan
        };
        
        // Update state
        dispatch({ type: "UPDATE_USER", payload: updatedUser });
      }
    };

    checkSubscription();
  }, [state.currentUser?.uid]);

  // Persist user data when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (state.currentUser) {
        // Store in both localStorage and cookies
        localStorage.setItem("user", JSON.stringify(state.currentUser));
        Cookies.set("user", JSON.stringify(state.currentUser), { 
          expires: 7, // Expires in 7 days
          sameSite: "strict",
          path: "/"
        });
      } else {
        // Clear both when logged out
        localStorage.removeItem("user");
        Cookies.remove("user", { path: "/" });
      }
    }
  }, [state.currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser: state.currentUser, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}; 