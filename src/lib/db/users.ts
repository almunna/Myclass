import { db } from "@/firebase/firebase";
import { doc, setDoc, getDoc, updateDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export interface UserSubscription {
  userId: string;
  email: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'inactive' | 'cancelled' | 'past_due';
  subscriptionPlan?: 'free' | 'basic' | 'premium' | 'admin';
  subscriptionStartDate?: any;
  subscriptionEndDate?: any;
  lastPaymentDate?: any;
  lastPaymentAmount?: number;
  createdAt?: any;
  updatedAt?: any;
}

// Create or update user subscription data
export async function createOrUpdateUserSubscription(userId: string, data: Partial<UserSubscription>) {
  try {
    console.log('📝 Updating user subscription:', { userId, data });
    
    // Get current user email if not provided
    const auth = getAuth();
    const email = data.email || auth.currentUser?.email || '';
    
    // Convert Date objects to Firestore Timestamps
    const dataWithTimestamps = { ...data };
    if (data.subscriptionStartDate instanceof Date) {
      dataWithTimestamps.subscriptionStartDate = Timestamp.fromDate(data.subscriptionStartDate);
    }
    if (data.subscriptionEndDate instanceof Date) {
      dataWithTimestamps.subscriptionEndDate = Timestamp.fromDate(data.subscriptionEndDate);
    }
    if (data.lastPaymentDate instanceof Date) {
      dataWithTimestamps.lastPaymentDate = Timestamp.fromDate(data.lastPaymentDate);
    }
    
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // Update existing user
      console.log('📝 Updating existing user document');
      await updateDoc(userRef, {
        ...dataWithTimestamps,
        email,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new user
      console.log('📝 Creating new user document');
      await setDoc(userRef, {
        userId,
        email,
        ...dataWithTimestamps,
        subscriptionStatus: dataWithTimestamps.subscriptionStatus || 'inactive',
        subscriptionPlan: dataWithTimestamps.subscriptionPlan || 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    console.log('✅ User subscription updated successfully');
    return { success: true };
  } catch (error) {
    console.error("❌ Error updating user subscription:", error);
    return { success: false, error };
  }
}

// Get user subscription data
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return userDoc.data() as UserSubscription;
    }
    return null;
  } catch (error) {
    console.error("Error getting user subscription:", error);
    return null;
  }
}

// Update subscription status after successful payment
export async function updateSubscriptionAfterPayment(
  userId: string,
  paymentAmount: number,
  stripeCustomerId?: string
) {
  const now = new Date();
  const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  
  return createOrUpdateUserSubscription(userId, {
    subscriptionStatus: 'active',
    subscriptionPlan: paymentAmount >= 900 ? 'premium' : 'basic', // Assuming $9+ is premium
    lastPaymentDate: now,
    lastPaymentAmount: paymentAmount,
    stripeCustomerId: stripeCustomerId,
    subscriptionStartDate: now,
    subscriptionEndDate: endDate,
  });
}

// Cancel/terminate subscription
export async function cancelUserSubscription(userId: string) {
  try {
    console.log('🚫 Cancelling subscription for user:', userId);
    
    const result = await createOrUpdateUserSubscription(userId, {
      subscriptionStatus: 'cancelled',
      subscriptionPlan: 'free',
      // Keep the end date as is, so they can use until it expires
    });
    
    console.log('✅ Subscription cancelled successfully');
    return result;
  } catch (error) {
    console.error("❌ Error cancelling subscription:", error);
    return { success: false, error };
  }
} 