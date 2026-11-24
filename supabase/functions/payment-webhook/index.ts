// Supabase Edge Function Contract: Payment & Payout Webhook Verification
// Never marks a payment or payout succeeded without verified provider signature & transaction ID

export interface PaymentVerificationPayload {
  paymentId: string;
  provider: string;
  providerTxId: string;
  signature: string;
  amount: number;
}

export function validateProviderConfirmation(payload: Partial<PaymentVerificationPayload>): {
  valid: boolean;
  reason?: string;
} {
  if (!payload.provider || !payload.providerTxId || !payload.signature) {
    return {
      valid: false,
      reason: 'Provider transaction ID and webhook signature are required before marking a payment succeeded.',
    };
  }
  if (typeof payload.amount !== 'number' || payload.amount <= 0) {
    return { valid: false, reason: 'Payment amount must be positive.' };
  }
  return { valid: true };
}
