"use client";

import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckOutPage from "@/components/CheckOutPage";
import { convertToSubCurrency } from "@/lib/convertToSubCurrency";
import { useAuth } from "@/hooks/useAuth";
import { cancelUserSubscription } from "@/lib/db/users";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle,
  Calendar,
  CreditCard,
  AlertCircle,
  Check,
  Star,
  Zap,
  Crown,
  Shield,
  Trophy,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string
);

// Pricing plans - Enhanced with better visual elements
const pricingPlans = [
  {
    name: "Monthly Pro",
    price: 1.5,
    description:
      "Perfect for trying out our premium features with full flexibility.",
    features: [
      "Unlimited students",
      "Advanced attendance tracking",
      "Detailed reports & analytics",
      "Export data (CSV)",
      "Multi-class management",
      "Priority email support",
    ],
    stripePriceId: "price_1RU1egLfV8BTXj9ALrUSRkb6",
    stripeProductId: "prod_SOpJZUuuVqoXxB",
    currency: "USD",
    interval: "month",
    popular: false,
    icon: <Star className="h-6 w-6" />,
    gradient: "from-blue-500 to-cyan-500",
    savings: null,
  },
  {
    name: "Annual Pro",
    price: 7.99,
    description:
      "Best value plan with significant savings for committed educators.",
    features: [
      "Everything in Monthly Pro",
      "Advanced attendance tracking",
      "Detailed reports & analytics",
      "Export data (CSV)",
      "Multi-class management",
      "Priority email support",
      "Advanced customization",
    ],
    stripePriceId: "price_1RU0I5LfV8BTXj9ApRkjeX9A",
    stripeProductId: "prod_SOntcZoMr75KOj",
    currency: "USD",
    interval: "year",
    popular: true,
    icon: <Crown className="h-6 w-6" />,
    gradient: "from-purple-500 to-pink-500",
    savings: "Save 47%",
  },
];

function page() {
  const { currentUser } = useAuth();
  const { dispatch } = useContext(AuthContext);
  const router = useRouter();
  const { subscription, loading, hasAccess, refetch } = useSubscriptionAccess();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<
    (typeof pricingPlans)[0] | null
  >(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleCancelSubscription = async () => {
    if (!currentUser?.uid) return;

    setCancelling(true);
    try {
      const result = await cancelUserSubscription(currentUser.uid);
      if (result.success) {
        // Update user context
        const updatedUser = {
          ...currentUser,
          hasActiveSubscription: false,
          subscriptionPlan: "free",
        };
        dispatch({ type: "UPDATE_USER", payload: updatedUser });

        // Refetch subscription data
        await refetch();

        // Refresh the page to show payment form
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
    }
    setCancelling(false);
    setShowCancelDialog(false);
  };

  const handleSelectPlan = (plan: (typeof pricingPlans)[0]) => {
    setSelectedPlan(plan);
    setShowCheckout(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">
            Loading your subscription...
          </p>
        </div>
      </div>
    );
  }

  // Enhanced subscription details view
  if (hasAccess && subscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative py-24 px-4">
            <div className="max-w-4xl mx-auto text-center text-white">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <span className="font-semibold">Active Subscription</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Your Subscription
              </h1>
              <p className="text-xl md:text-2xl text-blue-100 max-w-2xl mx-auto">
                Manage your current plan and billing details
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Subscription Card */}
              <div className="lg:col-span-2">
                <Card className="relative overflow-hidden shadow-2xl border-0">
                  {/* Success Header */}
                  <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-6">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-10 w-10" />
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-white/30 mb-4">
                      <Crown className="h-4 w-4 mr-1" />
                      Premium Member
                    </Badge>
                    <h2 className="text-3xl font-bold mb-2">
                      Active Subscription
                    </h2>
                    <p className="text-green-100 text-lg">
                      You have an active{" "}
                      <span className="font-bold capitalize">
                        {subscription.subscriptionPlan}
                      </span>{" "}
                      plan
                    </p>
                  </div>

                  {/* Details */}
                  <CardContent className="p-8 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <CreditCard className="h-5 w-5 text-blue-600" />
                            </div>
                            <span className="font-medium text-slate-700">
                              Current Plan
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 capitalize">
                            {subscription.subscriptionPlan}
                          </span>
                        </div>

                        {subscription.subscriptionEndDate && (
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Calendar className="h-5 w-5 text-purple-600" />
                              </div>
                              <span className="font-medium text-slate-700">
                                Valid Until
                              </span>
                            </div>
                            <span className="font-bold text-slate-900">
                              {subscription.subscriptionEndDate.toDate
                                ? subscription.subscriptionEndDate
                                    .toDate()
                                    .toLocaleDateString()
                                : subscription.subscriptionEndDate.seconds
                                ? new Date(
                                    subscription.subscriptionEndDate.seconds *
                                      1000
                                  ).toLocaleDateString()
                                : new Date(
                                    subscription.subscriptionEndDate
                                  ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {subscription.lastPaymentAmount && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-100 rounded-lg">
                                <Shield className="h-5 w-5 text-emerald-600" />
                              </div>
                              <span className="font-medium text-slate-700">
                                Last Payment
                              </span>
                            </div>
                            <span className="font-bold text-emerald-700">
                              ${subscription.lastPaymentAmount / 100}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cancel Button */}
                    <div className="pt-6 border-t border-slate-200">
                      <Button
                        variant="outline"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-3"
                        onClick={() => setShowCancelDialog(true)}
                        disabled={cancelling}
                      >
                        {cancelling ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent mr-2"></div>
                            Cancelling...
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Cancel Subscription
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-center text-slate-500 mt-3">
                        You can continue using the service until the end of your
                        billing period
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Benefits Sidebar */}
              <div className="space-y-6">
                <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Your Benefits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      "Unlimited students",
                      "Advanced tracking",
                      "Detailed reports",
                      "CSV exports",
                      "Multi-class support",
                      "Priority support",
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                        <span className="text-sm text-slate-700">
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0 bg-gradient-to-br from-emerald-50 to-green-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      Secure & Protected
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600">
                    <p>
                      Your subscription is secured with industry-standard
                      encryption and can be cancelled at any time.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Cancel Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <AlertDialogTitle className="text-xl font-bold">
                Cancel Subscription?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                You'll lose access to premium features after your current
                billing period ends. Your data will be preserved, but advanced
                features will be disabled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col gap-3 sm:flex-row">
              <AlertDialogCancel className="flex-1">
                Keep My Subscription
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelSubscription}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Yes, Cancel Subscription
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Enhanced checkout form
  if (showCheckout && selectedPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <Button
              variant="ghost"
              onClick={() => setShowCheckout(false)}
              className="mb-4 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Plans
            </Button>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Complete Your Purchase
              </h1>
              <p className="text-xl text-slate-600">
                You're subscribing to the{" "}
                <span className="font-semibold text-blue-600">
                  {selectedPlan.name}
                </span>{" "}
                plan
              </p>
            </div>
          </div>
        </div>

        {/* Checkout Content */}
        <div className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Plan Summary */}
              <Card className="shadow-2xl border-0 sticky top-8">
                <div
                  className={`bg-gradient-to-r ${selectedPlan.gradient} p-6 text-white relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      {selectedPlan.icon}
                    </div>
                  </div>
                  {selectedPlan.popular && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 text-sm font-bold shadow-lg">
                      <Crown className="h-4 w-4 mr-1" />
                      Best Value
                    </Badge>
                  )}
                  <h2 className="text-2xl font-bold mb-2">
                    {selectedPlan.name}
                  </h2>
                  <p className="text-white/90 mb-6">
                    {selectedPlan.description}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      ${selectedPlan.price}
                    </span>
                    <span className="text-white/80 text-lg">
                      /{selectedPlan.interval}
                    </span>
                    {selectedPlan.savings && (
                      <Badge className="bg-yellow-500 text-yellow-900 ml-3">
                        {selectedPlan.savings}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">
                    What's included:
                  </h3>
                  <ul className="space-y-3">
                    {selectedPlan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Payment Form */}
              <Card className="shadow-2xl border-0">
                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl text-slate-900">
                    Payment Details
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Enter your payment information securely
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Elements
                    stripe={stripePromise}
                    options={{
                      mode: "payment",
                      amount: convertToSubCurrency(selectedPlan.price),
                      currency: "usd",
                      setup_future_usage: "off_session",
                    }}
                  >
                    <CheckOutPage amount={selectedPlan.price} />
                  </Elements>

                  {/* Security Notice */}
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span>
                        Your payment is secured with 256-bit SSL encryption
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced pricing plans view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/50 to-transparent"></div>
        <div className="relative py-24 px-4">
          <div className="max-w-6xl mx-auto text-center text-white">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 px-4 py-2">
              <Sparkles className="h-4 w-4 mr-2" />
              Premium Plans Available
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
              Choose Your Plan
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-8">
              Select the perfect plan for your student tracking needs. Upgrade,
              downgrade, or cancel at any time with our flexible billing.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative ${plan.popular ? "pt-6" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 text-sm font-bold shadow-lg">
                      <Crown className="h-4 w-4 mr-1" />
                      Best Value
                    </Badge>
                  </div>
                )}
                <Card
                  className={`relative overflow-hidden shadow-2xl border-0 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 ${
                    plan.popular ? "ring-2 ring-purple-500 ring-offset-4" : ""
                  }`}
                >
                  {/* Header */}
                  <div
                    className={`bg-gradient-to-r ${plan.gradient} p-8 text-white relative`}
                  >
                    <div className="absolute top-0 right-0 p-6">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                        {plan.icon}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-white/90 mb-6">{plan.description}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold">${plan.price}</span>
                      <span className="text-white/80 text-lg">
                        /{plan.interval}
                      </span>
                      {plan.savings && (
                        <Badge className="bg-yellow-400 text-yellow-900 ml-3">
                          {plan.savings}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <CardContent className="p-8">
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-center gap-3"
                        >
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full py-4 text-lg font-semibold bg-gradient-to-r ${plan.gradient} hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl`}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Get Started - ${plan.price}/{plan.interval}
                      <Zap className="h-5 w-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="text-center mt-16">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                Why Choose MyClassLog?
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-slate-800 mb-2">
                    Secure Payments
                  </h4>
                  <p className="text-sm text-slate-600">
                    Bank-level security with encrypted transactions
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-slate-800 mb-2">
                    Cancel Anytime
                  </h4>
                  <p className="text-sm text-slate-600">
                    No long-term commitments or hidden fees
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default page;
