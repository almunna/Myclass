import { Lock, CreditCard, Star, Zap, Shield, Check, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface NoAccessProps {
  title?: string;
  description?: string;
}

export function NoAccess({ 
  title = "Premium Feature", 
  description = "This feature requires an active subscription to access." 
}: NoAccessProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Main Card */}
        <Card className="relative overflow-hidden shadow-2xl border-0 bg-white">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-6">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8" />
              </div>
          </div>
            <Badge className="bg-white/20 text-white border-white/30 mb-4">
              <Crown className="h-4 w-4 mr-1" />
              Premium Required
            </Badge>
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="text-white/90 text-lg">
            {description}
            </p>
          </div>
          
          {/* Content */}
          <CardContent className="p-8 space-y-6">
            {/* Benefits Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold text-slate-800">Subscribe to unlock:</h3>
              </div>
              <div className="grid gap-3">
                {[
                  "Unlimited students",
                  "Advanced attendance tracking", 
                  "Detailed reports & analytics",
                  "Export data (CSV)",
                  "Multi-class management",
                  "Priority email support"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* CTA Button */}
            <Link href="/subscription" className="block">
              <Button className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl">
                <Zap className="mr-2 h-5 w-5" />
                View Subscription Plans
            </Button>
          </Link>
          
            {/* Trust Indicators */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="text-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="h-4 w-4 text-green-600" />
                </div>

              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-xs font-medium text-slate-700">Cancel Anytime</p>
                <p className="text-xs text-slate-500">No commitments</p>
              </div>
            </div>
        </CardContent>
      </Card>

        {/* Bottom Notice */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-600">
            Already have a subscription? 
            <Link href="/subscription" className="ml-1 text-blue-600 hover:text-blue-700 font-medium">
              Check your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 