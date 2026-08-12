/**
 * M-Pesa remains intentionally unavailable until a complete Daraja payment
 * state machine, authenticated callbacks, reconciliation, and refunds exist.
 */

export interface MpesaPaymentRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export type MpesaDisabledStatus = "disabled";
export type MpesaDisabledErrorCode = "integration_not_configured";

export interface MpesaPaymentResponse {
  success: false;
  status: MpesaDisabledStatus;
  errorCode: MpesaDisabledErrorCode;
  checkoutRequestId?: string;
  errorMessage?: string;
}

export interface MpesaVerificationResponse {
  success: false;
  paid: false;
  status: MpesaDisabledStatus;
  errorCode: MpesaDisabledErrorCode;
}

export async function initiateSTKPush(
  _request: MpesaPaymentRequest
): Promise<MpesaPaymentResponse> {
  return {
    success: false,
    status: "disabled",
    errorCode: "integration_not_configured",
  };
}

export async function verifyTransaction(
  _checkoutRequestId: string
): Promise<MpesaVerificationResponse> {
  return {
    success: false,
    paid: false,
    status: "disabled",
    errorCode: "integration_not_configured",
  };
}
