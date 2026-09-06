import type { Person, Expense, PersonBalance, SettlementTransaction, FairShareGroup } from '../types/fairshare';

/**
 * Rounds a number to 2 decimal places to avoid floating point precision issues.
 */
export const round2 = (val: number): number => {
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

/**
 * Formats a numeric value with currency symbol.
 */
export const formatCurrency = (amount: number, currency: string = '$'): string => {
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (amount < 0) {
    return `-${currency}${formatted}`;
  }
  return `${currency}${formatted}`;
};

/**
 * Calculates total paid, total owed, and net balance for every participant.
 */
export const calculateBalances = (
  participants: Person[],
  expenses: Expense[]
): PersonBalance[] => {
  const participantMap = new Map<string, Person>();
  participants.forEach((p) => participantMap.set(p.id, p));

  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  // Initialize all participants with 0
  participants.forEach((p) => {
    paidMap.set(p.id, 0);
    owedMap.set(p.id, 0);
  });

  // Calculate contributions and consumptions
  expenses.forEach((expense) => {
    const amount = Number(expense.amount) || 0;
    if (amount <= 0) return;

    // Add to payer's total paid
    const currentPaid = paidMap.get(expense.paidBy) || 0;
    paidMap.set(expense.paidBy, currentPaid + amount);

    // Determine who splits this expense
    const splitTargetIds = expense.splitAmong && expense.splitAmong.length > 0
      ? expense.splitAmong
      : participants.map((p) => p.id);

    // Filter valid participant IDs
    const validTargetIds = splitTargetIds.filter((id) => participantMap.has(id));

    if (validTargetIds.length > 0) {
      const share = amount / validTargetIds.length;
      validTargetIds.forEach((pId) => {
        const currentOwed = owedMap.get(pId) || 0;
        owedMap.set(pId, currentOwed + share);
      });
    }
  });

  // Build the result list
  return participants.map((person) => {
    const totalPaid = round2(paidMap.get(person.id) || 0);
    const totalOwed = round2(owedMap.get(person.id) || 0);
    const netBalance = round2(totalPaid - totalOwed);

    return {
      person,
      totalPaid,
      totalOwed,
      netBalance,
    };
  });
};

/**
 * Calculates the minimal number of settlement transactions required
 * to balance all debts (Greedy Min-Cash-Flow Algorithm).
 */
export const calculateSettlements = (
  participants: Person[],
  expenses: Expense[],
  settledTransactionIds: string[] = []
): SettlementTransaction[] => {
  const balances = calculateBalances(participants, expenses);

  interface BalanceNode {
    person: Person;
    amount: number;
  }

  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  balances.forEach((b) => {
    if (b.netBalance < -0.009) {
      debtors.push({ person: b.person, amount: Math.abs(b.netBalance) });
    } else if (b.netBalance > 0.009) {
      creditors.push({ person: b.person, amount: b.netBalance });
    }
  });

  // Sort by highest amounts first to optimize debt resolution
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SettlementTransaction[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferAmount = round2(Math.min(debtor.amount, creditor.amount));

    if (transferAmount > 0.009) {
      const transactionId = `settle_${debtor.person.id}_${creditor.person.id}_${transferAmount.toFixed(2)}`;
      
      transactions.push({
        id: transactionId,
        fromPerson: debtor.person,
        toPerson: creditor.person,
        amount: transferAmount,
        isSettled: settledTransactionIds.includes(transactionId),
      });

      debtor.amount = round2(debtor.amount - transferAmount);
      creditor.amount = round2(creditor.amount - transferAmount);
    }

    if (debtor.amount < 0.01) {
      dIdx++;
    }
    if (creditor.amount < 0.01) {
      cIdx++;
    }
  }

  return transactions;
};

/**
 * Generates an easily readable text summary for WhatsApp sharing without emojis.
 */
export const generateWhatsAppSummary = (
  group: FairShareGroup,
  balances: PersonBalance[],
  settlements: SettlementTransaction[]
): string => {
  const totalSpent = round2(group.expenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0));
  const avgPerPerson = group.participants.length > 0
    ? round2(totalSpent / group.participants.length)
    : 0;

  const lines: string[] = [];

  lines.push(`*RESUMEN DE CUENTAS - FAIRSHARE*`);
  lines.push(`Evento: ${group.title || 'Gastos Compartidos'}`);
  lines.push(`Gasto Total: ${formatCurrency(totalSpent, group.currency)}`);
  lines.push(`Participantes: ${group.participants.length} (Promedio: ${formatCurrency(avgPerPerson, group.currency)} c/u)`);
  lines.push(``);

  lines.push(`*BALANCES INDIVIDUALES:*`);
  balances.forEach((b) => {
    let statusText = 'Al día ($0.00)';

    if (b.netBalance > 0.009) {
      statusText = `Le deben ${formatCurrency(b.netBalance, group.currency)}`;
    } else if (b.netBalance < -0.009) {
      statusText = `Debe pagar ${formatCurrency(Math.abs(b.netBalance), group.currency)}`;
    }

    lines.push(`- *${b.person.name}*: Pagó ${formatCurrency(b.totalPaid, group.currency)} | Consumió ${formatCurrency(b.totalOwed, group.currency)} -> *${statusText}*`);
  });
  lines.push(``);

  lines.push(`*PAGOS SUGERIDOS PARA LIQUIDAR:*`);
  if (settlements.length === 0) {
    lines.push(`Todas las cuentas están totalmente equilibradas. No hay pagos pendientes.`);
  } else {
    settlements.forEach((s) => {
      const settledMark = s.isSettled ? '[PAGADO]' : '[PENDIENTE]';
      lines.push(`${settledMark} *${s.fromPerson.name}* transfiere *${formatCurrency(s.amount, group.currency)}* a *${s.toPerson.name}*`);
    });
  }

  lines.push(``);
  lines.push(`Calculado con FairShare`);

  return lines.join('\n');
};
