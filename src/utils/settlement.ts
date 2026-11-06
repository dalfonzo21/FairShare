import type { 
  Person, 
  Expense, 
  PersonBalance, 
  SettlementTransaction, 
  FairShareGroup,
  CashRoundingScale,
  CashRoundingStrategy,
  SurplusDestination,
  CashRoundingOptions,
  CashSettlementDetail,
  CashSettlementSummary,
} from '../types/fairshare';

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

    // 1. Who paid? (Contributions / Haber)
    if (expense.payers && expense.payers.length > 0) {
      // Multi-payer support (Vaca / Partial contributions)
      expense.payers.forEach((payer) => {
        if (participantMap.has(payer.personId)) {
          const payerAmt = Number(payer.amount) || 0;
          if (payerAmt > 0) {
            const currentPaid = paidMap.get(payer.personId) || 0;
            paidMap.set(payer.personId, currentPaid + payerAmt);
          }
        }
      });
    } else if (expense.paidBy && participantMap.has(expense.paidBy)) {
      // Single payer
      const currentPaid = paidMap.get(expense.paidBy) || 0;
      paidMap.set(expense.paidBy, currentPaid + amount);
    }

    // 2. Who owes? (Consumptions / Debe)
    if (expense.splitType === 'items' && expense.items && expense.items.length > 0) {
      let itemsSum = 0;
      const itemConsumers = new Set<string>();

      expense.items.forEach((item) => {
        const itemAmt = Number(item.amount) || 0;
        if (itemAmt <= 0) return;
        itemsSum += itemAmt;

        const assignedIds = (item.assignedTo && item.assignedTo.length > 0)
          ? item.assignedTo.filter((id) => participantMap.has(id))
          : participants.map((p) => p.id);

        if (assignedIds.length > 0) {
          const share = itemAmt / assignedIds.length;
          assignedIds.forEach((pId) => {
            itemConsumers.add(pId);
            const currentOwed = owedMap.get(pId) || 0;
            owedMap.set(pId, currentOwed + share);
          });
        }
      });

      // Handle extra fee or remainder if itemsSum != amount
      const remainder = round2(amount - itemsSum);
      if (Math.abs(remainder) > 0.009) {
        let targetIds: string[] = [];
        if (expense.extraFeeSplitType === 'all') {
          targetIds = participants.map((p) => p.id);
        } else if (itemConsumers.size > 0) {
          targetIds = Array.from(itemConsumers);
        } else {
          targetIds = participants.map((p) => p.id);
        }

        if (targetIds.length > 0) {
          const remainderShare = remainder / targetIds.length;
          targetIds.forEach((pId) => {
            const currentOwed = owedMap.get(pId) || 0;
            owedMap.set(pId, currentOwed + remainderShare);
          });
        }
      }
    } else if (expense.splitType === 'exact' && expense.customSplits && expense.customSplits.length > 0) {
      let customSum = 0;
      const targetIds: string[] = [];

      expense.customSplits.forEach((split) => {
        if (participantMap.has(split.personId)) {
          const splitAmt = Number(split.amount) || 0;
          customSum += splitAmt;
          targetIds.push(split.personId);
          const currentOwed = owedMap.get(split.personId) || 0;
          owedMap.set(split.personId, currentOwed + splitAmt);
        }
      });

      // If customSum differs slightly from total amount, allocate remainder among assigned targets
      const remainder = round2(amount - customSum);
      if (Math.abs(remainder) > 0.009 && targetIds.length > 0) {
        const remainderShare = remainder / targetIds.length;
        targetIds.forEach((pId) => {
          const currentOwed = owedMap.get(pId) || 0;
          owedMap.set(pId, currentOwed + remainderShare);
        });
      }
    } else {
      // Default: Equal split among splitAmong
      const splitTargetIds = expense.splitAmong && expense.splitAmong.length > 0
        ? expense.splitAmong
        : participants.map((p) => p.id);

      const validTargetIds = splitTargetIds.filter((id) => participantMap.has(id));

      if (validTargetIds.length > 0) {
        const share = amount / validTargetIds.length;
        validTargetIds.forEach((pId) => {
          const currentOwed = owedMap.get(pId) || 0;
          owedMap.set(pId, currentOwed + share);
        });
      }
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
 * Returns human-readable label for cash rounding scale.
 */
export const getScaleLabel = (scale: CashRoundingScale): string => {
  switch (scale) {
    case 0.05:
      return '5¢ (Níquel)';
    case 0.10:
      return '10¢ (Dime)';
    case 0.25:
      return '25¢ (Cuarto)';
    case 0.50:
      return '50¢ (Medio Dólar)';
    case 1.00:
      return '$1.00 (Entero)';
    default:
      return '1¢ (Exacto)';
  }
};

/**
 * Returns human-readable label for surplus destination.
 */
export const getSurplusDestinationLabel = (destination: SurplusDestination): string => {
  switch (destination) {
    case 'tip_pool':
      return 'Fondo Común / Propina';
    case 'creditor':
      return 'A favor de quien cobra';
    case 'debtor_discount':
      return 'Descuento al que paga';
    default:
      return 'Fondo Común';
  }
};

/**
 * Rounds an amount to a specific cash coin scale (5¢, 10¢, 25¢, 50¢, $1).
 */
export const roundToCoinScale = (
  amount: number,
  scale: CashRoundingScale,
  strategy: CashRoundingStrategy = 'nearest'
): number => {
  if (scale <= 0.01 || amount <= 0) return round2(amount);

  const factor = Math.round(1 / scale);
  if (strategy === 'up') {
    return round2(Math.ceil((amount - 1e-9) * factor) / factor);
  }
  if (strategy === 'down') {
    return round2(Math.max(0, Math.floor((amount + 1e-9) * factor) / factor));
  }
  // nearest
  return round2(Math.round(amount * factor) / factor);
};

/**
 * Generates the cash settlements breakdown with excedent calculations.
 */
export const calculateCashSettlements = (
  transactions: SettlementTransaction[],
  options: CashRoundingOptions
): CashSettlementSummary => {
  const details: CashSettlementDetail[] = transactions.map((tx) => {
    const exact = round2(tx.amount);
    let cash = roundToCoinScale(exact, options.scale, options.strategy);
    if (cash === 0 && exact > 0 && options.scale > 0.01 && options.strategy !== 'down') {
      cash = options.scale;
    }
    const diff = round2(cash - exact);
    return {
      transactionId: tx.id,
      fromPerson: tx.fromPerson,
      toPerson: tx.toPerson,
      exactAmount: exact,
      cashAmount: cash,
      difference: diff,
      isSettled: tx.isSettled,
    };
  });

  const totalExact = round2(details.reduce((acc, d) => acc + d.exactAmount, 0));
  const totalCash = round2(details.reduce((acc, d) => acc + d.cashAmount, 0));
  const totalSurplus = round2(totalCash - totalExact);

  return {
    details,
    totalExact,
    totalCash,
    totalSurplus,
    scale: options.scale,
    strategy: options.strategy,
    surplusDestination: options.surplusDestination,
  };
};

/**
 * Calculates a fair cash approximation using standard physical circulating coins (5¢ scale),
 * resolving debts without requiring impossible 1, 2, or 3 cent coins.
 */
export const calculateFairCashSettlements = (
  transactions: SettlementTransaction[]
): CashSettlementSummary => {
  return calculateCashSettlements(transactions, {
    scale: 0.05,
    strategy: 'nearest',
    surplusDestination: 'tip_pool',
  });
};

/**
 * Generates an easily readable text summary for WhatsApp sharing.
 */
export const generateWhatsAppSummary = (
  group: FairShareGroup,
  balances: PersonBalance[],
  settlements: SettlementTransaction[],
  cashSummary?: CashSettlementSummary | null
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
    // 1. Digital transfer option (exact to the cent)
    lines.push(`💳 *Por Transferencia (Exacto al centavo)*:`);
    settlements.forEach((s) => {
      const settledMark = s.isSettled ? '[PAGADO] ' : '';
      lines.push(`${settledMark}- *${s.fromPerson.name}* transfiere *${formatCurrency(s.amount, group.currency)}* a *${s.toPerson.name}*`);
    });

    // 2. Physical cash option (fair approximation)
    if (cashSummary) {
      lines.push(``);
      lines.push(`💵 *En Efectivo (Aproximado Justo en Monedas)*:`);
      cashSummary.details.forEach((d) => {
        const settledMark = d.isSettled ? '[PAGADO] ' : '';
        const diffText = d.difference > 0.009
          ? ` (+${formatCurrency(d.difference, group.currency)} diferencia)`
          : d.difference < -0.009
            ? ` (-${formatCurrency(Math.abs(d.difference), group.currency)} diferencia)`
            : ` (exacto)`;
        lines.push(`${settledMark}- *${d.fromPerson.name}* entrega *${formatCurrency(d.cashAmount, group.currency)}* a *${d.toPerson.name}*${diffText}`);
      });

      if (Math.abs(cashSummary.totalSurplus) > 0.009) {
        lines.push(`ℹ️ Diferencia en efectivo: ${cashSummary.totalSurplus > 0 ? '+' : ''}${formatCurrency(cashSummary.totalSurplus, group.currency)} (casi no se cuenta; propina o a favor de quien cobra)`);
      }
    }
  }

  lines.push(``);
  lines.push(`Calculado con FairShare`);

  return lines.join('\n');
};
