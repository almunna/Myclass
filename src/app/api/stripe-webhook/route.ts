export const dynamic = "force-dynamic"; // prevents prerender
export const runtime = "nodejs";        // ensure Node runtime

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { updateSubscriptionAfterPayment } from "@/lib/db/users";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  console.log("🔔 Webhook received");
  
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("❌ No signature in webhook");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    console.log("✅ Webhook verified, event type:", event.type);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
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
      
      // Update user subscription in database
      if (paymentIntent.metadata?.userId) {
        console.log('🔄 Updating user subscription for userId:', paymentIntent.metadata.userId);
        const result = await updateSubscriptionAfterPayment(
          paymentIntent.metadata.userId,
          paymentIntent.amount,
          paymentIntent.customer
        );
        console.log('✅ Subscription update result:', result);
      } else {
        console.error('❌ No userId in payment metadata');
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('❌ Payment failed:', failedPayment.id);
      // Handle failed payment (e.g., send email, update status)
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      console.log('📅 Subscription event:', subscription.id);
      // Handle subscription events if using Stripe subscriptions
      break;

    default:
      console.log(`⚠️ Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
} 