"use client";

interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Add other user properties as needed
}

interface AuthState {
  currentUser: User | null;
}

type AuthAction = 
  | { type: "LOGIN"; payload: User }
  | { type: "LOGOUT" };

const AuthReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "LOGIN": {
      return {
        currentUser: action.payload,
      };
    }
    case "LOGOUT": {
      return {
        currentUser: null,
      };
    }
    default:
      return state;
  }
};

export default AuthReducer; 