import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import Stripe from "npm:stripe@14.20.0";

// Stripe configuration
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY environment variable");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

Deno.serve(async (req: Request) => {
  // Get the signature from the header
  const signature = req.headers.get("stripe-signature");

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Missing signature or webhook secret" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get request body as text for webhook verification
    const body = await req.text();
    
    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        const subscriptionId = session.subscription;

        if (!userId || !tier || !subscriptionId) {
          throw new Error("Missing required metadata in checkout session");
        }

        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);

        // Get subscription tier from database
        const { data: tierData } = await supabase
          .from("subscription_tiers")
          .select("*")
          .eq("name", tier)
          .single();

        if (!tierData) {
          throw new Error(`Subscription tier ${tier} not found`);
        }

        // Update user profile with subscription info
        await supabase
          .from("profiles")
          .update({
            subscription_tier: tier,
            subscription_id: subscriptionId,
            subscription_status: subscription.status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            credits: tierData.credits_per_cycle,
          })
          .eq("id", userId);

        // Add entry to subscription history
        await supabase
          .from("subscription_history")
          .insert({
            profile_id: userId,
            subscription_tier_id: tierData.id,
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            start_date: new Date(subscription.current_period_start * 1000).toISOString(),
            end_date: new Date(subscription.current_period_end * 1000).toISOString(),
          });

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, subscription_tier")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) {
          throw new Error(`No user found with customer ID ${customerId}`);
        }

        const userId = profile.id;
        const tier = profile.subscription_tier;
        
        // Get subscription tier data
        const { data: tierData } = await supabase
          .from("subscription_tiers")
          .select("*")
          .eq("name", tier)
          .single();

        // Update user profile with subscription info
        await supabase
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("id", userId);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) {
          throw new Error(`No user found with customer ID ${customerId}`);
        }

        const userId = profile.id;

        // Update user profile to free tier
        await supabase
          .from("profiles")
          .update({
            subscription_tier: "free",
            subscription_status: "inactive",
            subscription_id: null,
            credits: 5, // Default free tier credits
          })
          .eq("id", userId);

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        if (!subscriptionId) break;

        // Find user by customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, subscription_tier")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) break;

        const userId = profile.id;
        const tier = profile.subscription_tier;

        // Get subscription tier data
        const { data: tierData } = await supabase
          .from("subscription_tiers")
          .select("*")
          .eq("name", tier)
          .single();

        if (!tierData) break;

        // Add credits to user's account for the new billing period
        await supabase
          .from("profiles")
          .update({
            credits: tierData.credits_per_cycle,
            subscription_status: "active",
          })
          .eq("id", userId);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find user by customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) break;

        const userId = profile.id;

        // Update subscription status
        await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("id", userId);

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error handling webhook:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process webhook" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});