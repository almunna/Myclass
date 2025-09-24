"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserSubscription,
  createOrUpdateUserSubscription,
} from "@/lib/db/users";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { convertToSubCurrency } from "@/lib/convertToSubCurrency";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount");
  const paymentIntent = searchParams.get("payment_intent");
  const { currentUser } = useAuth();
  const { dispatch } = useContext(AuthContext);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateAndFetchSubscription = async () => {
      if (!currentUser?.uid) {
        console.log("No current user found");
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      if (!amount) {
        console.log("No amount found");
        setError("No payment amount found");
        setLoading(false);
        return;
      }

      try {
        console.log("Updating subscription for user:", currentUser.uid);

        // Calculate subscription dates
        const now = new Date();
        const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        const amountInCents = convertToSubCurrency(parseFloat(amount));

        // Save subscription directly to Firestore
        const result = await createOrUpdateUserSubscription(currentUser.uid, {
          email: currentUser.email || "",
          subscriptionStatus: "active",
          subscriptionPlan: amountInCents >= 900 ? "premium" : "basic",
          lastPaymentDate: now,
          lastPaymentAmount: amountInCents,
          subscriptionStartDate: now,
          subscriptionEndDate: endDate,
        });

        console.log("Subscription update result:", result);

        if (result.success) {
          // Fetch the updated subscription
          console.log("Fetching updated subscription");
          const userSub = await getUserSubscription(currentUser.uid);
          console.log("Fetched subscription:", userSub);
          setSubscription(userSub);

          // Update user context with subscription status
          const updatedUser = {
            ...currentUser,
            hasActiveSubscription: true,
            subscriptionPlan: userSub?.subscriptionPlan || "basic",
          };
          dispatch({ type: "UPDATE_USER", payload: updatedUser });
        } else {
          setError("Failed to update subscription");
        }
      } catch (error) {
        console.error("Error updating subscription:", error);
        setError("Failed to update subscription");
      }
      setLoading(false);
    };

    updateAndFetchSubscription();
  }, [currentUser, amount, dispatch]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="text-red-500">
            <p className="text-xl font-semibold">Error</p>
            <p className="mt-2">{error}</p>
          </div>
          <Link href="/subscription">
            <Button>Try Again</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4"
      suppressHydrationWarning
    >
      <div className="max-w-md w-full space-y-8 text-center">
        <div suppressHydrationWarning>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        </div>

        <div>
          <h2 className="text-3xl font-bold">Payment Successful!</h2>
          <p className="mt-2 text-gray-600">
            Thank you for your payment of ${amount}
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500">Updating subscription details...</p>
        ) : subscription ? (
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <h3 className="font-semibold mb-2">Subscription Details:</h3>
            <p className="text-sm text-gray-600">
              Status:{" "}
              <span className="font-medium text-green-600">
                {subscription.subscriptionStatus}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Plan:{" "}
              <span className="font-medium">
                {subscription.subscriptionPlan}
              </span>
            </p>
            {subscription.subscriptionEndDate && (
              <p className="text-sm text-gray-600">
                Valid until:{" "}
                <span className="font-medium">
                  {subscription.subscriptionEndDate.toDate
                    ? subscription.subscriptionEndDate
                        .toDate()
                        .toLocaleDateString()
                    : subscription.subscriptionEndDate.seconds
                    ? new Date(
                        subscription.subscriptionEndDate.seconds * 1000
                      ).toLocaleDateString()
                    : new Date(
                        subscription.subscriptionEndDate
                      ).toLocaleDateString()}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-500">Subscription details saved.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/subscription">
            <Button variant="outline">View Subscription</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
