import { plaidClient, getPlaidAccessToken } from '../services/plaidClient';

export async function getAccountBalances(userId: string) {
  try {
    const accessToken = await getPlaidAccessToken(userId);
    const res = await plaidClient.accountsBalanceGet({ access_token: accessToken });

    const accounts = res.data.accounts.map((a) => ({
      name: a.name,
      officialName: a.official_name,
      type: a.type,
      subtype: a.subtype,
      available: a.balances.available,
      current: a.balances.current,
      currency: a.balances.iso_currency_code,
    }));

    return JSON.stringify({ accounts });
  } catch (err: any) {
    return JSON.stringify({
      error: err?.response?.data?.error_message ?? err.message ?? 'Failed to fetch account balances.',
    });
  }
}

export async function getRecentTransactions(userId: string, args: { days?: number }) {
  try {
    const accessToken = await getPlaidAccessToken(userId);
    const days = args.days ?? 7;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const format = (d: Date) => d.toISOString().slice(0, 10);

    const res = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: format(startDate),
      end_date: format(endDate),
      options: { count: 50, offset: 0 },
    });

    const transactions = res.data.transactions.map((t) => ({
      name: t.name,
      merchant: t.merchant_name,
      amount: t.amount,
      currency: t.iso_currency_code,
      date: t.date,
      category: t.category,
      pending: t.pending,
    }));

    return JSON.stringify({ transactions });
  } catch (err: any) {
    return JSON.stringify({
      error: err?.response?.data?.error_message ?? err.message ?? 'Failed to fetch recent transactions.',
    });
  }
}
