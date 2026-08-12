/**
 * Stripe billing remains intentionally unavailable until subscription plans,
 * webhook verification, entitlement state, and recovery flows are complete.
 */

export interface CreateSubscriptionRequest {
  email: string;
  priceId: string;
  paymentMethodId: string;
}

export interface StripeDisabledResult {
  success: false;
  status: "disabled";
  errorCode: "integration_not_configured";
}

export interface SubscriptionResponse extends StripeDisabledResult {
  subscriptionId?: string;
  clientSecret?: string;
}

export async function createSubscription(
  _request: CreateSubscriptionRequest
): Promise<SubscriptionResponse> {
  return {
    success: false,
    status: "disabled",
    errorCode: "integration_not_configured",
  };
}

export async function cancelSubscription(
  _subscriptionId: string
): Promise<StripeDisabledResult> {
  return {
    success: false,
    status: "disabled",
    errorCode: "integration_not_configured",
  };
}

export async function handleWebhook(
  _payload: string,
  _signature: string
): Promise<StripeDisabledResult> {
  return {
    success: false,
    status: "disabled",
    errorCode: "integration_not_configured",
  };
}
