"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { z } from "zod";
import { Mail, Lock, Loader2, Eye, EyeOff, MessageSquare } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      showToast(emailResult.error.issues[0].message, "error");
      return;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      showToast(passwordResult.error.issues[0].message, "error");
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error, isUserNotFound } = await signIn(email, password);
      
      if (isUserNotFound) {
        // Auto-redirect to signup flow with the email preserved
        setIsLogin(false);
        showToast(
          "No account found with this email. Let's create one for you!",
          "info"
        );
        setLoading(false);
        return;
      }
      
      if (error) {
        showToast(error.message, "error");
      }
    } else {
      const { error, needsEmailVerification, emailAlreadyExists } = await signUp(email, password);
      
      if (error) {
        showToast(error.message, "error");
      } else if (emailAlreadyExists) {
        showToast(
          "An account with this email already exists. Please sign in instead.",
          "error"
        );
        // Switch to login mode
        setIsLogin(true);
        setPassword("");
      } else if (needsEmailVerification) {
        showToast(
          `🎉 Account created! We sent a verification link to ${email}. Please check your inbox and click the link to activate your account.`,
          "success",
          true // persistent
        );
        // Switch to login mode after successful signup
        setIsLogin(true);
        setPassword("");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 rounded-2xl shadow-xl">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Pawrent</h1>
          <p className="text-muted-foreground mt-1">Pet OS Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-xl"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl text-lg font-semibold bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        {/* Sign Up / Sign In Toggle */}
        <div className="text-center mt-4">
          {isLogin ? (
            <>
              <p className="text-muted-foreground text-sm mb-2">
                Don't have an account?
              </p>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="px-6 py-1.5 text-primary font-bold text-sm border border-primary rounded-lg hover:bg-primary/10 transition-colors"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm mb-2">
                Already have an account?
              </p>
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="px-6 py-1.5 text-primary font-bold text-sm border border-primary rounded-lg hover:bg-primary/10 transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Feedback Link */}
        <div className="flex justify-center mt-3">
          <a
            href="/feedback?anonymous=true"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Feedback</span>
          </a>
        </div>
      </Card>
    </div>
  );
}
