/**
 * M-Pesa Integration Module (Stub)
 *
 * Integration target: Safaricom Daraja API (STK Push)
 * This module is ready for activation once API credentials are configured.
 *
 * Required env vars:
 *   MPESA_CONSUMER_KEY
 *   MPESA_CONSUMER_SECRET
 *   MPESA_PASSKEY
 *   MPESA_SHORTCODE
 */

export interface MpesaPaymentRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface MpesaPaymentResponse {
  success: boolean;
  checkoutRequestId?: string;
  errorMessage?: string;
}

export async function initiateSTKPush(
  request: MpesaPaymentRequest
): Promise<MpesaPaymentResponse> {
  console.log(
    `[M-Pesa Stub] Would initiate STK push: KES ${request.amount} to ${request.phoneNumber}`
  );

  // TODO: Implement Daraja API integration
  // 1. Get OAuth token from https://sandbox.safaricom.co.ke/oauth/v1/generate
  // 2. POST to https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
  // 3. Handle callback at /api/mpesa/callback

  return { success: true, checkoutRequestId: "stub-checkout-id" };
}

export async function verifyTransaction(
  checkoutRequestId: string
): Promise<{ paid: boolean }> {
  console.log(`[M-Pesa Stub] Would verify transaction: ${checkoutRequestId}`);

  // TODO: Query Daraja API for transaction status

  return { paid: false };
}
