/**
 * Stripe Subscription Billing Module (Stub)
 *
 * Integration target: Stripe Subscriptions API
 * For SalonBook SaaS billing — charging business owners a monthly fee.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 */

export interface CreateSubscriptionRequest {
  email: string;
  priceId: string;
  paymentMethodId: string;
}

export interface SubscriptionResponse {
  success: boolean;
  subscriptionId?: string;
  clientSecret?: string;
}

export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<SubscriptionResponse> {
  console.log(
    `[Stripe Stub] Would create subscription for ${request.email} with price ${request.priceId}`
  );

  // TODO: Implement Stripe integration
  // 1. Create or retrieve Stripe customer
  // 2. Attach payment method
  // 3. Create subscription
  // 4. Return client secret for confirmation

  return { success: true, subscriptionId: "stub-sub-id" };
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<{ success: boolean }> {
  console.log(`[Stripe Stub] Would cancel subscription: ${subscriptionId}`);
  return { success: true };
}

export async function handleWebhook(
  payload: string,
  signature: string
): Promise<void> {
  console.log(`[Stripe Stub] Would process webhook with signature: ${signature.slice(0, 20)}...`);

  // TODO: Verify webhook signature and process events
  // - invoice.payment_succeeded
  // - customer.subscription.deleted
  // - customer.subscription.updated
  void payload;
}
