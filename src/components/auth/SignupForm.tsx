"use client";

import { useState, useContext } from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth } from "@/firebase/firebase"
import { AuthContext } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { LoginFormIcon } from "@/icons/LoginFormIcon"
import Link from "next/link"
import { signupSchema, usernameSchema, emailSchema, passwordSchema, type SignupSchema } from "@/lib/validation"
import { z } from "zod"
import { PasswordInput } from "@/components/ui/password-input"
import { toast } from "sonner"
import { getAuthErrorMessage } from "@/lib/auth-errors"
import { Loader2 } from "lucide-react"

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter()
  const { dispatch } = useContext(AuthContext)
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const validateField = (field: keyof SignupSchema, value: string) => {
    try {
      // Create a partial object with just the field we're validating
      const partialData = { ...userData, [field]: value }
      
      // For individual field validation, we'll use specific validators
      if (field === 'username') {
        usernameSchema.parse(value)
      } else if (field === 'email') {
        emailSchema.parse(value)
      } else if (field === 'password') {
        passwordSchema.parse(value)
      } else if (field === 'confirmPassword') {
        // For confirm password, we need to check both password and confirmPassword
        if (userData.password && value) {
          signupSchema.parse(partialData)
        }
      }
      
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.find(err => 
          err.path.length === 0 || err.path.includes(field)
        )?.message || error.errors[0]?.message || 'Invalid input'
        
        setFieldErrors((prev) => ({ 
          ...prev, 
          [field]: errorMessage
        }))
      }
    }
  }

  const handleInputChange = (field: keyof SignupSchema, value: string) => {
    setUserData({ ...userData, [field]: value })
    // Clear general error when user starts typing
    if (error) setError(null)
    // Validate field on change (debounced would be better but this is simpler)
    if (value.length > 0) {
      validateField(field, value)
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isLoading) return // Prevent multiple submissions
    
    // Validate all fields
    try {
      signupSchema.parse(userData)
      setFieldErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message
          }
        })
        setFieldErrors(errors)
        toast.error("Please fix the validation errors before continuing.")
        return
      }
    }

    if (!acceptedTerms) {
      const errorMsg = "Please accept the Terms of Service and Privacy Policy to continue"
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    setIsLoading(true)
    try {
      setError(null) // Clear any previous errors
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password)
      const user = userCredential.user
      dispatch({ type: "LOGIN", payload: user })
      
      toast.success("Account created successfully! Welcome to Student Tracker.")
      router.push("/")
    } catch (error: any) {
      const authError = getAuthErrorMessage(error)
      setError(authError.message)
      toast.error(authError.message)
      
      // Log error for debugging (remove in production)
      console.error('Signup error:', authError.code, authError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSignup}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Create an account</h1>
                <p className="text-balance text-muted-foreground">Sign up to get started</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  type="text" 
                  placeholder="johndoe" 
                  required 
                  value={userData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={fieldErrors.username ? 'border-red-500 focus:border-red-500' : ''}
                />
                {fieldErrors.username && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.username}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m@example.com" 
                  required 
                  value={userData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''}
                />
                {fieldErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput 
                  id="password" 
                  required 
                  value={userData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={fieldErrors.password ? 'border-red-500 focus:border-red-500' : ''}
                />
                {fieldErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.password}</p>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput 
                  id="confirmPassword" 
                  required 
                  value={userData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={fieldErrors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Label htmlFor="acceptTerms" className="flex items-start space-x-3 cursor-pointer text-sm text-gray-700 leading-relaxed">
                  <Checkbox 
                    id="acceptTerms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                    className="mt-0.5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 flex-shrink-0"
                  />
                  <span>
                    I agree to the{" "}
                    <Link 
                      href="/terms-of-service" 
                      className="font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors"
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link 
                      href="/privacy-policy" 
                      className="font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors"
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </Label>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Sign up"
                )}
              </Button>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <a href="/login" className="underline underline-offset-4">
                  Log in
                </a>
              </div>
            </div>
          </form>
          <div className="relative hidden bg-muted md:block">
            <LoginFormIcon />
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking sign up, you agree to our{" "}
        <Link href="/terms-of-service" className="text-blue-600 hover:text-blue-800">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-800">
          Privacy Policy
        </Link>.
      </div>
    </div>
  )
} 