/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Set global options
setGlobalOptions({
  region: "us-central1",
});

// Initialize Stripe (moved inside functions to avoid build-time errors)
const getStripe = () => {
  const stripe = require("stripe");
  return stripe(process.env.STRIPE_SECRET_KEY);
};

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Create Payment Intent Function
export const createPaymentIntent = onRequest(
  { cors: true },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { amount } = request.body;
      const stripe = getStripe();
      
      // Get user from cookie or headers
      const userCookie = request.headers.cookie?.split(';')
        .find(c => c.trim().startsWith('user='))?.split('=')[1];
      
      let user = null;
      if (userCookie) {
        try {
          user = JSON.parse(decodeURIComponent(userCookie));
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }

      if (!user) {
        response.status(401).json({ error: "User not authenticated" });
        return;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        setup_future_usage: "off_session",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: user.uid,
          userEmail: user.email,
        },
      });

      response.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Payment intent error:", error);
      response.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// Stripe Webhook Function
export const stripeWebhook = onRequest(
  { cors: true },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    console.log("🔔 Webhook received");
    
    const stripe = getStripe();
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const body = request.rawBody;
    const signature = request.headers["stripe-signature"];

    if (!signature) {
      console.error("❌ No signature in webhook");
      response.status(400).json({ error: "No signature" });
      return;
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
      console.log("✅ Webhook verified, event type:", event.type);
    } catch (err: any) {
      console.error(`❌ Webhook Error: ${err.message}`);
      response.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('💰 PaymentIntent was successful!', {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata
        });
        
        // Update user subscription in Firestore
        if (paymentIntent.metadata?.userId) {
          console.log('🔄 Updating user subscription for userId:', paymentIntent.metadata.userId);
          try {
            const userRef = db.collection('users').doc(paymentIntent.metadata.userId);
            
            // Calculate subscription end date (assuming annual subscription)
            const subscriptionEndDate = new Date();
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
            
            await userRef.update({
              hasActiveSubscription: true,
              subscriptionPlan: 'admin',
              subscriptionStartDate: new Date(),
              subscriptionEndDate: subscriptionEndDate,
              lastPaymentAmount: paymentIntent.amount,
              lastPaymentDate: new Date(),
              stripeCustomerId: paymentIntent.customer || null,
            });
            
            console.log('✅ Subscription updated successfully');
          } catch (error) {
            console.error('❌ Error updating subscription:', error);
          }
        } else {
          console.error('❌ No userId in payment metadata');
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('❌ Payment failed:', failedPayment.id);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        console.log('📅 Subscription event:', subscription.id);
        break;

      default:
        console.log(`⚠️ Unhandled event type ${event.type}`);
    }

    response.json({ received: true });
  }
);
