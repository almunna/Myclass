import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserSubscription, UserSubscription } from "@/lib/db/users";
import { hasAdminAccess } from "@/lib/admin";

export function useSubscriptionAccess() {
  const { currentUser } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      console.log("Checking subscription access for user:", currentUser?.uid);
      
      // Check for admin access first
      if (currentUser && hasAdminAccess(currentUser)) {
        console.log("Admin user detected - bypassing subscription check");
        setHasAccess(true);
        setSubscription({
          userId: currentUser.uid,
          email: currentUser.email || '',
          subscriptionStatus: 'active',
          subscriptionPlan: 'admin'
        });
        setLoading(false);
        return;
      }
      
      if (currentUser?.uid) {
        const userSub = await getUserSubscription(currentUser.uid);
        console.log("Fetched subscription:", userSub);
        setSubscription(userSub);
        
        // Check if user has active subscription
        const isActive = userSub?.subscriptionStatus === 'active';
        const isNotExpired = userSub?.subscriptionEndDate ? 
          new Date(userSub.subscriptionEndDate.toDate ? userSub.subscriptionEndDate.toDate() : userSub.subscriptionEndDate) > new Date() 
          : false;
        
        const hasValidAccess = isActive && isNotExpired;
        setHasAccess(hasValidAccess);
        
        console.log("Subscription access check:", {
          isActive,
          isNotExpired,
          hasValidAccess
        });
      } else {
        setHasAccess(false);
      }
      setLoading(false);
    };

    fetchSubscription();
  }, [currentUser]);

  return {
    subscription,
    loading,
    hasAccess,
    isActive: subscription?.subscriptionStatus === 'active',
    subscriptionPlan: subscription?.subscriptionPlan || 'free',
    subscriptionEndDate: subscription?.subscriptionEndDate,
    refetch: async () => {
      if (currentUser?.uid) {
        setLoading(true);
        
        // Check for admin access first
        if (hasAdminAccess(currentUser)) {
          setHasAccess(true);
          setSubscription({
            userId: currentUser.uid,
            email: currentUser.email || '',
            subscriptionStatus: 'active',
            subscriptionPlan: 'admin'
          });
          setLoading(false);
          return;
        }
        
        const userSub = await getUserSubscription(currentUser.uid);
        setSubscription(userSub);
        const isActive = userSub?.subscriptionStatus === 'active';
        const isNotExpired = userSub?.subscriptionEndDate ? 
          new Date(userSub.subscriptionEndDate.toDate ? userSub.subscriptionEndDate.toDate() : userSub.subscriptionEndDate) > new Date() 
          : false;
        setHasAccess(isActive && isNotExpired);
        setLoading(false);
      }
    }
  };
} 