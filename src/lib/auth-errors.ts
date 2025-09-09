import { FirebaseError } from "firebase/app"

export interface AuthErrorResult {
  message: string
  code: string
}

export function getAuthErrorMessage(error: unknown): AuthErrorResult {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      // Sign up errors
      case 'auth/email-already-in-use':
        return {
          message: 'An account with this email already exists. Please try signing in instead.',
          code: error.code
        }
      case 'auth/weak-password':
        return {
          message: 'Password is too weak. Please choose a stronger password.',
          code: error.code
        }
      case 'auth/invalid-email':
        return {
          message: 'Please enter a valid email address.',
          code: error.code
        }
      
      // Sign in errors
      case 'auth/user-not-found':
        return {
          message: 'No account found with this email address. Please check your email or sign up.',
          code: error.code
        }
      case 'auth/wrong-password':
        return {
          message: 'Incorrect password. Please try again.',
          code: error.code
        }
      case 'auth/invalid-credential':
        return {
          message: 'Invalid email or password. Please check your credentials and try again.',
          code: error.code
        }
      case 'auth/user-disabled':
        return {
          message: 'This account has been disabled. Please contact support.',
          code: error.code
        }
      case 'auth/too-many-requests':
        return {
          message: 'Too many failed attempts. Please try again later.',
          code: error.code
        }
      
      // Network and other errors
      case 'auth/network-request-failed':
        return {
          message: 'Network error. Please check your connection and try again.',
          code: error.code
        }
      case 'auth/operation-not-allowed':
        return {
          message: 'Email/password sign-in is not enabled. Please contact support.',
          code: error.code
        }
      case 'auth/requires-recent-login':
        return {
          message: 'Please sign in again to complete this action.',
          code: error.code
        }
      
      default:
        return {
          message: error.message || 'An unexpected error occurred. Please try again.',
          code: error.code
        }
    }
  }
  
  // Handle non-Firebase errors
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred. Please try again.',
      code: 'unknown'
    }
  }
  
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'unknown'
  }
} 