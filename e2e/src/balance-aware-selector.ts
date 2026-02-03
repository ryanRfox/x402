export interface PaymentMethod {
  asset: string;
  network: string;
  protocol: string;
}

export type BalanceChecker = (method: PaymentMethod) => Promise<bigint>;

export type PaymentSelector = (
  accepts: PaymentMethod[],
  getBalance: BalanceChecker,
  clientPreference?: (methods: PaymentMethod[]) => PaymentMethod[]
) => Promise<PaymentMethod | null>;

export const selectPaymentMethod: PaymentSelector = async (
  accepts,
  getBalance,
  clientPreference
) => {
  if (accepts.length === 0) {
    return null;
  }

  const methods = clientPreference ? clientPreference(accepts) : accepts;

  for (const method of methods) {
    const balance = await getBalance(method);
    if (balance > 0n) {
      return method;
    }
  }

  return null;
};
