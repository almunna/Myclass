export const dynamic = "force-dynamic"; // prevents prerender
export const runtime = "nodejs";        // ensure Node runtime

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { updateSubscriptionAfterPayment } from "@/lib/db/users";

// ---- Lazy Stripe init (no top-level env read / side effects)
let _stripe: any | undefined;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // require at runtime to keep module side-effect free
  const Stripe = require("stripe");
  _stripe = new Stripe(key); // omit apiVersion to avoid TS literal mismatch
  return _stripe;
}

export async function POST(request: NextRequest) {
  console.log("🔔 Webhook received");

  const stripe = getStripe();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !endpointSecret) {
    console.error("❌ Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  // Stripe requires the raw body for signature verification
  const buf = Buffer.from(await request.arrayBuffer());

  // headers() is synchronous; cast to the standard Headers type for TS
  const headersList = headers() as unknown as Headers;
  const signature = headersList.get("stripe-signature");
  if (!signature) {
    console.error("❌ No signature in webhook");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(buf, signature, endpointSecret);
    console.log("✅ Webhook verified, event type:", event.type);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      console.log("💰 PaymentIntent was successful!", {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        metadata: paymentIntent.metadata,
      });

      if (paymentIntent.metadata?.userId) {
        console.log("🔄 Updating user subscription for userId:", paymentIntent.metadata.userId);
        const result = await updateSubscriptionAfterPayment(
          paymentIntent.metadata.userId,
          paymentIntent.amount,
          paymentIntent.customer
        );
        console.log("✅ Subscription update result:", result);
      } else {
        console.error("❌ No userId in payment metadata");
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const failedPayment = event.data.object;
      console.log("❌ Payment failed:", failedPayment.id);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      console.log("📅 Subscription event:", subscription.id);
      break;
    }

    default:
      console.log(`⚠️ Unhandled event type ${event.type}`);
  }

  // Respond quickly with 2xx for Stripe
  return new NextResponse("ok", { status: 200 });
}
