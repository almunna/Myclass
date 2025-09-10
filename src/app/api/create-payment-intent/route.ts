import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json();

    // Get user from cookie (await cookies())
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user");
    const user = userCookie ? JSON.parse(userCookie.value) : null;

    if (!user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      console.error("STRIPE_SECRET_KEY is not set");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Initialize Stripe at request time
    const stripe = require("stripe")(secret);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: user.uid,
        userEmail: user.email,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
