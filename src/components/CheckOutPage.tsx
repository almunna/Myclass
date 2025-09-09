"use client";

import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { convertToSubCurrency } from "@/lib/convertToSubCurrency";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

function CheckOutPage({ amount }: { amount: number }) {
    const stripe = useStripe();
    const elements = useElements();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    useEffect(() => {
        const createPaymentIntent = async () => {
            try {
                console.log("Creating payment intent for amount:", amount);
                
            const response = await fetch("/api/create-payment-intent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ amount: convertToSubCurrency(amount) }),
            });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

            const data = await response.json();
                if (data.clientSecret) {
            setClientSecret(data.clientSecret);
                } else {
                    throw new Error('No client secret received');
                }
            } catch (error: any) {
                console.error("Payment intent creation failed:", error);
                setErrorMessage("Payment setup failed. Please try again.");
            }
        };

        createPaymentIntent();
    }, [amount]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);

        if (!stripe || !elements || !clientSecret) {
            setIsLoading(false);
            return;
        }

        const { error: submitError } = await elements.submit();
        if (submitError) {
            setErrorMessage(submitError?.message || "An error occurred");
            setIsLoading(false);
            return;
        }

        const { error: confirmError } = await stripe.confirmPayment({
            elements,
            clientSecret,
            confirmParams: {
                return_url: `${window.location.origin}/payment-success?amount=${amount}`,
            },
        });
        
        if (confirmError) {
            setErrorMessage(confirmError?.message || "An error occurred");
        }
        setIsLoading(false);
    }

    if (!clientSecret || !stripe || !elements) {
        return (
            <div className="flex flex-col items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Setting up payment...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
                <PaymentElement />
            
            {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-700 text-sm">{errorMessage}</p>
                </div>
            )}

            <Button 
                type="submit" 
                disabled={isLoading || !stripe || !clientSecret} 
                className="w-full"
            >
                {isLoading ? "Processing..." : `Pay $${amount}`}
            </Button>
        </form>
    );
}

export default CheckOutPage;