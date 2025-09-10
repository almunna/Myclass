import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  console.log("🔔 Webhook received");

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("❌ No signature in webhook");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !endpointSecret) {
    console.error("❌ Stripe secrets not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // No apiVersion option → avoids literal-type mismatch
  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    console.log("✅ Webhook verified, event type:", event.type);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Lazy-load db helper to avoid build-time Firebase init
  const { updateSubscriptionAfterPayment } = await import("@/lib/db/users");

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;

      const customerId =
        typeof pi.customer === "string" ? pi.customer : undefined;

      if (pi.metadata?.userId) {
        await updateSubscriptionAfterPayment(
          pi.metadata.userId,
          pi.amount,
          customerId
        );
      } else {
        console.error("❌ No userId in payment metadata");
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const failed = event.data.object as Stripe.PaymentIntent;
      console.log("❌ Payment failed:", failed.id);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      console.log("📅 Subscription event:", sub.id);
      break;
    }
    default:
      console.log(`⚠️ Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
