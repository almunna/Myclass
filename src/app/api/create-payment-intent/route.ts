export const dynamic = "force-dynamic"; // prevents prerender
export const runtime = "nodejs";        // ensure Node runtime

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
    try {
        const { amount } = await request.json();
        
        // Get user from cookie
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user");
        const user = userCookie ? JSON.parse(userCookie.value) : null;

        if (!user) {
            return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
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

        return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}