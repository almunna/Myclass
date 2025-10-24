// app/student-login/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, GraduationCap, Eye, EyeOff } from "lucide-react";
import { loginStudent } from "@/lib/student";
import { LoginFormIcon } from "@/icons/LoginFormIcon"; // right-side illustration

export default function StudentLoginPage() {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      await loginStudent(username.trim(), password.trim());
      // Hard redirect should occur inside loginStudent()
    } catch (err: any) {
      console.error("Student login failed:", err);
      setError(err?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <Card className="overflow-hidden w-full max-w-3xl mx-auto">
        {/* Match layout of Login page: two-column card */}
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Left: form */}
          <form onSubmit={handleStudentLogin} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              {/* Header (match style) */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Student Login</h1>
                <p className="text-balance text-muted-foreground">
                  Use the credentials provided by your teacher.
                </p>
              </div>

              {/* Username */}
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. STU-00123"
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>

              {/* Password + show/hide */}
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-2 inline-flex items-center"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If your teacher uses Student ID for both: enter your Student
                  ID in <em>both</em> fields.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="text-sm text-red-600 rounded border border-red-200 bg-red-50 p-2">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Logging in…
                  </span>
                ) : (
                  "Login"
                )}
              </Button>
            </div>
          </form>

          {/* Right: illustration panel (same as Login page) */}
          <div className="relative hidden bg-muted md:block">
            <LoginFormIcon />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
