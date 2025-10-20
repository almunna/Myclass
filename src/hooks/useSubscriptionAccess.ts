// hooks/useSubscriptionAccess.ts
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserSubscription, UserSubscription } from "@/lib/db/users";
import { hasAdminAccess } from "@/lib/admin";
import { auth } from "@/firebase/firebase";
import Cookies from "js-cookie";

export function useSubscriptionAccess() {
  const { currentUser } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const authUser = auth.currentUser;
        const isAnon = !!authUser && (authUser as any).isAnonymous === true;

        // (Optional) cookie role check for extra safety
        const cookieRole = (() => {
          try {
            const raw = Cookies.get("user");
            return raw ? JSON.parse(raw)?.role : undefined;
          } catch {
            return undefined;
          }
        })();

        // 0) Anonymous student → always allow (read-only pages)
        if (isAnon || cookieRole === "student") {
          setHasAccess(true);
          setSubscription(null); // ← don't use "student" plan; avoid type conflicts
          setLoading(false);
          return;
        }

        // 1) Admin bypass
        if (currentUser && hasAdminAccess(currentUser)) {
          setHasAccess(true);
          setSubscription({
            userId: currentUser.uid,
            email: currentUser.email || "",
            subscriptionStatus: "active",
            subscriptionPlan: "admin",
          });
          setLoading(false);
          return;
        }

        // 2) Normal signed-in teacher → fetch subscription
        if (currentUser?.uid) {
          const userSub = await getUserSubscription(currentUser.uid);
          setSubscription(userSub);

          const isActive = userSub?.subscriptionStatus === "active";
          const end = userSub?.subscriptionEndDate;
          const endDate =
            end && typeof (end as any)?.toDate === "function"
              ? (end as any).toDate()
              : end
              ? new Date(end as any)
              : null;

          const isNotExpired = endDate ? endDate > new Date() : false;
          setHasAccess(isActive && isNotExpired);
        } else {
          // No user and not anon → no access
          setHasAccess(false);
        }
      } catch (err) {
        console.error("Subscription check error:", err);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [currentUser]);

  const refetch = async () => {
    // Re-run the same logic quickly
    // (You can factor the above into a memoized function if you prefer)
    // For brevity, just toggle loading and rely on currentUser change or call fetchSubscription inline.
    try {
      setLoading(true);
      const authUser = auth.currentUser;
      const isAnon = !!authUser && (authUser as any).isAnonymous === true;
      if (isAnon) {
        setHasAccess(true);
        setSubscription(null); // ← keep null for anonymous/student
        return;
      }
      if (currentUser && hasAdminAccess(currentUser)) {
        setHasAccess(true);
        setSubscription({
          userId: currentUser.uid,
          email: currentUser.email || "",
          subscriptionStatus: "active",
          subscriptionPlan: "admin",
        });
        return;
      }
      if (currentUser?.uid) {
        const userSub = await getUserSubscription(currentUser.uid);
        setSubscription(userSub);
        const isActive = userSub?.subscriptionStatus === "active";
        const end = userSub?.subscriptionEndDate;
        const endDate =
          end && typeof (end as any)?.toDate === "function"
            ? (end as any).toDate()
            : end
            ? new Date(end as any)
            : null;
        setHasAccess(isActive && !!endDate && endDate > new Date());
      } else {
        setHasAccess(false);
      }
    } catch (e) {
      console.error("Subscription refetch error:", e);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    loading,
    hasAccess,
    isActive: subscription?.subscriptionStatus === "active",
    subscriptionPlan: subscription?.subscriptionPlan || "free",
    subscriptionEndDate: subscription?.subscriptionEndDate,
    refetch,
  };
}
