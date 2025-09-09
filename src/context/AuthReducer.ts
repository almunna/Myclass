"use client";

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

type AuthAction = 
  | { type: "LOGIN"; payload: User }
  | { type: "LOGOUT" }
  | { type: "UPDATE_USER"; payload: User };

const AuthReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "LOGIN":
      return {
        currentUser: action.payload,
      };
    case "LOGOUT":
      return {
        currentUser: null,
      };
    case "UPDATE_USER":
      return {
        currentUser: action.payload,
      };
    default:
      return state;
  }
};

export default AuthReducer; 
 