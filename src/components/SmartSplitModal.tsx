import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Sparkles, 
  DollarSign, 
  Share2, 
  CreditCard, 
  Scale, 
  ArrowRight, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  Receipt,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Coins
} from 'lucide-react';
import type { 
  Person, 
  Expense, 
  ExpenseCategory, 
  ExpenseItem, 
  ExpensePayer,
  PaymentMethod
} from '../types/fairshare';
import { getInitials, generateId } from '../services/storage';
import { 
  formatCurrency, 
  round2, 
  calculateSettlements,
  calculateFairCashSettlements
} from '../utils/settlement';

interface SmartSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Person[];
  currency: string;
  onSaveExpense: (expense: Omit<Expense, 'id'>) => void;
  onShowToast: (msg: string) => void;
  initialExpense?: Expense | null;
}

interface QuickPurchaseItem {
  id: string;
  name: string;
  amount: string; // string so it can be blank without hardcoded values
  payerIds: string[]; // only participants who contributed money for this purchase
  payerMode: 'single' | 'multi'; // backward compatibility
  paidBy: string; // primary payer
  payers: Record<string, string>; // personId -> amount string
  assignedTo: string[]; // consumers sharing the cost
  isPayersExpanded?: boolean;
}

export interface EffectivePayerInfo {
  personId: string;
  name: string;
  rawAmount: number;
  effectiveAmount: number;
  vueltoReceived: number;
}

export interface PurchaseItemAnalysis {
  itAmt: number;
  rawTotalPaid: number;
  effectiveTotalPaid: number;
  vuelto: number;
  missingAmount: number;
  highestPayers: { personId: string; name: string; rawAmount: number }[];
  effectivePayers: EffectivePayerInfo[];
}

export function analyzePurchasePayers(
  item: QuickPurchaseItem,
  participants: Person[]
): PurchaseItemAnalysis {
  const itAmt = round2(parseFloat(item.amount) || 0);

  // Active payer IDs: ONLY participants who are selected as having contributed
  const activePayerIds = (item.payerIds && item.payerIds.length > 0)
    ? item.payerIds
    : (item.paidBy ? [item.paidBy] : (participants[0]?.id ? [participants[0].id] : []));

  if (activePayerIds.length === 0) {
    return {
      itAmt,
      rawTotalPaid: 0,
      effectiveTotalPaid: 0,
      vuelto: 0,
      missingAmount: itAmt,
      highestPayers: [],
      effectivePayers: [],
    };
  }

  // If exactly 1 person is selected as aportante
  if (activePayerIds.length === 1) {
    const pId = activePayerIds[0];
    const pName = participants.find((p) => p.id === pId)?.name || 'Aportante';
    const rawValStr = item.payers?.[pId];
    const rawVal = parseFloat(rawValStr) || 0;
    // If user explicitly typed a number, use it. If empty/unset and item has amount, default to full item amount!
    const enteredAmt = (rawValStr !== undefined && rawValStr !== '' && rawVal > 0)
      ? round2(rawVal)
      : (rawValStr === '0' ? 0 : itAmt);

    const diff = round2(enteredAmt - itAmt);
    const vuelto = diff > 0.009 ? diff : 0;
    const missingAmount = diff < -0.009 ? round2(Math.abs(diff)) : (enteredAmt === 0 && itAmt > 0 ? itAmt : 0);
    const effectiveAmount = round2(Math.max(0, enteredAmt - vuelto));

    return {
      itAmt,
      rawTotalPaid: enteredAmt,
      effectiveTotalPaid: effectiveAmount,
      vuelto,
      missingAmount,
      highestPayers: [{ personId: pId, name: pName, rawAmount: enteredAmt }],
      effectivePayers: [
        {
          personId: pId,
          name: pName,
          rawAmount: enteredAmt,
          effectiveAmount,
          vueltoReceived: vuelto,
        },
      ],
    };
  }

  // Multiple aportantes selected: collect contributions only from the selected payerIds!
  const rawEntries = activePayerIds
    .map((pId) => {
      const p = participants.find((pr) => pr.id === pId);
      return {
        personId: pId,
        name: p?.name || 'Aportante',
        rawAmount: round2(parseFloat(item.payers?.[pId]) || 0),
      };
    })
    .filter((e) => e.rawAmount > 0);

  const rawTotalPaid = round2(rawEntries.reduce((acc, e) => acc + e.rawAmount, 0));
  const diff = round2(rawTotalPaid - itAmt);

  if (rawEntries.length === 0) {
    return {
      itAmt,
      rawTotalPaid: 0,
      effectiveTotalPaid: 0,
      vuelto: 0,
      missingAmount: itAmt,
      highestPayers: [],
      effectivePayers: [],
    };
  }

  if (diff > 0.009) {
    // Vuelto! Excess money paid.
    // Find highest amount paid among contributors
    const maxVal = Math.max(...rawEntries.map((e) => e.rawAmount));
    const highestList = rawEntries.filter((e) => Math.abs(e.rawAmount - maxVal) < 0.009);

    // Split vuelto among the highest payers (usually 1 person, but handles ties equitably)
    const vueltoPerPerson = round2(diff / highestList.length);
    let distributedVuelto = 0;

    const effectivePayers: EffectivePayerInfo[] = rawEntries.map((e) => {
      const isHighest = highestList.some((h) => h.personId === e.personId);
      if (isHighest) {
        // Last highest payer gets remaining penny if odd division
        const remainingVuelto = round2(diff - distributedVuelto);
        const personVuelto = highestList.indexOf(highestList.find((h) => h.personId === e.personId)!) === highestList.length - 1
          ? remainingVuelto
          : vueltoPerPerson;

        distributedVuelto = round2(distributedVuelto + personVuelto);
        const netAmt = round2(Math.max(0, e.rawAmount - personVuelto));

        return {
          personId: e.personId,
          name: e.name,
          rawAmount: e.rawAmount,
          effectiveAmount: netAmt,
          vueltoReceived: personVuelto,
        };
      }

      return {
        personId: e.personId,
        name: e.name,
        rawAmount: e.rawAmount,
        effectiveAmount: e.rawAmount,
        vueltoReceived: 0,
      };
    });

    const effectiveTotalPaid = round2(effectivePayers.reduce((acc, p) => acc + p.effectiveAmount, 0));

    return {
      itAmt,
      rawTotalPaid,
      effectiveTotalPaid,
      vuelto: diff,
      missingAmount: 0,
      highestPayers: highestList.map((h) => ({ personId: h.personId, name: h.name, rawAmount: h.rawAmount })),
      effectivePayers,
    };
  } else {
    // Exact or missing
    const effectivePayers: EffectivePayerInfo[] = rawEntries.map((e) => ({
      personId: e.personId,
      name: e.name,
      rawAmount: e.rawAmount,
      effectiveAmount: e.rawAmount,
      vueltoReceived: 0,
    }));

    return {
      itAmt,
      rawTotalPaid,
      effectiveTotalPaid: rawTotalPaid,
      vuelto: 0,
      missingAmount: round2(Math.max(0, itAmt - rawTotalPaid)),
      highestPayers: [],
      effectivePayers,
    };
  }
}

export const SmartSplitModal: React.FC<SmartSplitModalProps> = ({
  isOpen,
  onClose,
  participants,
  currency,
  onSaveExpense,
  onShowToast,
  initialExpense,
}) => {
  // Mode: 'single_bill' vs 'multi_purchases'
  const [activeTab, setActiveTab] = useState<'single_bill' | 'multi_purchases'>('single_bill');

  // General info - clean placeholders, no burned-in hardcoded values
  const [title, setTitle] = useState('');
  const category: ExpenseCategory = 'food';
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // --- STATE FOR MODE 1: SINGLE BILL / MESA ---
  const [totalBillAmount, setTotalBillAmount] = useState<string>('');
  const [billConsumers, setBillConsumers] = useState<string[]>([]);
  const [contributions, setContributions] = useState<Record<string, string>>({});

  // --- STATE FOR MODE 2: MULTI-PURCHASES ---
  const [purchases, setPurchases] = useState<QuickPurchaseItem[]>([]);
  const purchasesContainerRef = useRef<HTMLDivElement>(null);
  const newlyAddedIdRef = useRef<string | null>(null);

  // --- CASH ROUNDING FOR SETTLEMENTS ---
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');

  // Synchronize defaults whenever modal opens or participants change
  useEffect(() => {
    if (!isOpen) return;

    if (initialExpense) {
      setTitle(initialExpense.title || '');
      if (initialExpense.splitType === 'items' && initialExpense.items && initialExpense.items.length > 0) {
        setActiveTab('multi_purchases');
        setPurchases(
          initialExpense.items.map((it) => {
            const itemPayersRecord: Record<string, string> = {};
            const itemPayerIds: string[] = [];
            if (it.payers && it.payers.length > 0) {
              it.payers.forEach((p) => {
                itemPayersRecord[p.personId] = p.amount.toString();
                itemPayerIds.push(p.personId);
              });
            } else if (it.paidBy) {
              itemPayersRecord[it.paidBy] = it.amount ? it.amount.toString() : '';
              itemPayerIds.push(it.paidBy);
            }
            return {
              id: it.id || generateId(),
              name: it.name || '',
              amount: it.amount ? it.amount.toString() : '',
              payerIds: itemPayerIds.length > 0 ? itemPayerIds : [participants[0]?.id || ''],
              payerMode: itemPayerIds.length > 1 ? 'multi' : 'single',
              paidBy: it.paidBy || initialExpense.paidBy || participants[0]?.id || '',
              payers: itemPayersRecord,
              assignedTo: it.assignedTo && it.assignedTo.length > 0 ? it.assignedTo : participants.map((p) => p.id),
              isPayersExpanded: itemPayerIds.length > 1,
            };
          })
        );
      } else {
        setActiveTab('single_bill');
        setTotalBillAmount(initialExpense.amount ? initialExpense.amount.toString() : '');
        setBillConsumers(
          initialExpense.splitAmong && initialExpense.splitAmong.length > 0
            ? initialExpense.splitAmong
            : participants.map((p) => p.id)
        );
        const contribMap: Record<string, string> = {};
        if (initialExpense.payers && initialExpense.payers.length > 0) {
          initialExpense.payers.forEach((p) => {
            contribMap[p.personId] = p.amount.toString();
          });
        } else if (initialExpense.paidBy) {
          contribMap[initialExpense.paidBy] = initialExpense.amount.toString();
        }
        setContributions(contribMap);
      }
    } else {
      // Reset fresh with no hardcoded pre-filled values
      setTitle('');
      setTotalBillAmount('');
      setBillConsumers(participants.map((p) => p.id));
      setContributions({});
      setPurchases([
        {
          id: generateId(),
          name: '',
          amount: '',
          payerIds: [participants[0]?.id || ''],
          payerMode: 'single',
          paidBy: participants[0]?.id || '',
          payers: {},
          assignedTo: participants.map((p) => p.id),
          isPayersExpanded: false,
        },
      ]);
    }
  }, [isOpen, initialExpense, participants]);

  // -------------------------------------------------------------
  // CALCULATIONS FOR MODE 1: SINGLE BILL
  // -------------------------------------------------------------
  const parsedTotalBill = round2(parseFloat(totalBillAmount) || 0);

  const totalCollectedInMode1 = round2(
    participants.reduce((acc, p) => acc + (parseFloat(contributions[p.id]) || 0), 0)
  );

  const billDiff = round2(parsedTotalBill - totalCollectedInMode1);

  const activeConsumerCount = billConsumers.length > 0 ? billConsumers.length : participants.length;
  const targetConsumers = billConsumers.length > 0 ? billConsumers : participants.map((p) => p.id);
  const fairSharePerPerson = activeConsumerCount > 0 ? round2(parsedTotalBill / activeConsumerCount) : 0;

  const mode1PersonBalances = participants.map((person) => {
    const isConsumer = targetConsumers.includes(person.id);
    const consumed = isConsumer ? fairSharePerPerson : 0;
    const paid = round2(parseFloat(contributions[person.id]) || 0);
    const net = round2(paid - consumed);

    return {
      person,
      isConsumer,
      consumed,
      paid,
      net,
    };
  });

  // -------------------------------------------------------------
  // CALCULATIONS FOR MODE 2: MULTI-PURCHASES
  // -------------------------------------------------------------
  const totalPurchasesAmount = round2(
    purchases.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0)
  );

  const totalCollectedInMode2 = round2(
    purchases.reduce((acc, it) => {
      const analysis = analyzePurchasePayers(it, participants);
      return acc + analysis.effectiveTotalPaid;
    }, 0)
  );

  const mode2PersonBalances = participants.map((person) => {
    let paid = 0;
    let consumed = 0;

    purchases.forEach((it) => {
      const itAmount = round2(parseFloat(it.amount) || 0);
      if (itAmount <= 0) return;

      // Who paid (effective net contribution after deducting change/vuelto)
      const analysis = analyzePurchasePayers(it, participants);
      const payerEntry = analysis.effectivePayers.find((ep) => ep.personId === person.id);
      if (payerEntry) {
        paid += payerEntry.effectiveAmount;
      }

      // Who consumed
      const assigned = it.assignedTo.length > 0 ? it.assignedTo : participants.map((p) => p.id);
      if (assigned.includes(person.id)) {
        consumed += itAmount / assigned.length;
      }
    });

    const net = round2(paid - consumed);

    return {
      person,
      isConsumer: consumed > 0,
      consumed: round2(consumed),
      paid: round2(paid),
      net,
    };
  });

  // -------------------------------------------------------------
  // ACTIVE CALCULATION DATA
  // -------------------------------------------------------------
  const currentTotalAmount = activeTab === 'single_bill' ? parsedTotalBill : totalPurchasesAmount;
  const currentTotalCollected = activeTab === 'single_bill' ? totalCollectedInMode1 : totalCollectedInMode2;
  const currentBalances = activeTab === 'single_bill' ? mode1PersonBalances : mode2PersonBalances;

  // Construct virtual expenses for settlement calculations
  const virtualExpenses: Expense[] = useMemo(() => {
    if (activeTab === 'single_bill') {
      const payersList: ExpensePayer[] = participants
        .map((p) => ({
          personId: p.id,
          amount: round2(parseFloat(contributions[p.id]) || 0),
        }))
        .filter((p) => p.amount > 0);

      const primaryPayer = payersList[0]?.personId || participants[0]?.id || '';

      return [
        {
          id: 'temp_virtual_bill',
          title: title.trim() || 'Cuenta de Mesa',
          amount: parsedTotalBill,
          paidBy: primaryPayer,
          splitAmong: targetConsumers,
          category,
          date: new Date().toISOString().split('T')[0],
          splitType: 'equal',
          payers: payersList.length > 0 ? payersList : [{ personId: primaryPayer, amount: parsedTotalBill }],
        },
      ];
    } else {
      // Multi-purchases
      return purchases
        .filter((p) => (parseFloat(p.amount) || 0) > 0)
        .map((p, idx) => {
          const itAmt = round2(parseFloat(p.amount) || 0);
          const analysis = analyzePurchasePayers(p, participants);
          const payersList: ExpensePayer[] = analysis.effectivePayers
            .filter((ep) => ep.effectiveAmount > 0)
            .map((ep) => ({
              personId: ep.personId,
              amount: ep.effectiveAmount,
            }));

          const primaryPayer = payersList[0]?.personId || p.paidBy || participants[0]?.id || '';

          return {
            id: `temp_purchase_${idx}`,
            title: p.name.trim() || `Compra #${idx + 1}`,
            amount: itAmt,
            paidBy: primaryPayer,
            splitAmong: p.assignedTo.length > 0 ? p.assignedTo : participants.map((pr) => pr.id),
            category,
            date: new Date().toISOString().split('T')[0],
            splitType: 'equal',
            payers: payersList.length > 0 ? payersList : [{ personId: primaryPayer, amount: itAmt }],
          };
        });
    }
  }, [activeTab, title, parsedTotalBill, targetConsumers, category, contributions, purchases, participants]);

  // Run Greedy Min-Cash-Flow settlement algorithm
  const calculatedSettlements = useMemo(() => {
    if (currentTotalAmount <= 0 || participants.length === 0) return [];
    try {
      return calculateSettlements(participants, virtualExpenses);
    } catch (err) {
      console.error('Error calculando liquidación en SmartSplit:', err);
      return [];
    }
  }, [participants, virtualExpenses, currentTotalAmount]);

  // Cash settlements calculation with fair approximation
  const cashSummary = useMemo(() => {
    return calculateFairCashSettlements(calculatedSettlements);
  }, [calculatedSettlements]);

  // -------------------------------------------------------------
  // ACTIONS & HANDLERS
  // -------------------------------------------------------------
  const handleAssignRemainderToPerson = (personId: string) => {
    if (billDiff <= 0) return;
    const current = parseFloat(contributions[personId]) || 0;
    const updated = round2(current + billDiff);
    setContributions((prev) => ({
      ...prev,
      [personId]: updated > 0 ? updated.toString() : '',
    }));
    onShowToast(`Se sumaron ${formatCurrency(billDiff, currency)} al aporte de ${participants.find((p) => p.id === personId)?.name || ''}.`);
  };

  const handleDistributeRemainderEqually = () => {
    if (billDiff <= 0 || participants.length === 0) return;
    const share = round2(billDiff / participants.length);
    setContributions((prev) => {
      const next: Record<string, string> = { ...prev };
      participants.forEach((p) => {
        const cur = parseFloat(next[p.id]) || 0;
        next[p.id] = (cur + share).toString();
      });
      return next;
    });
    onShowToast(`Se repartieron los ${formatCurrency(billDiff, currency)} faltantes entre todos.`);
  };

  const handleSyncBillToCollected = () => {
    if (totalCollectedInMode1 > 0) {
      setTotalBillAmount(totalCollectedInMode1.toString());
      onShowToast(`Monto total ajustado a ${formatCurrency(totalCollectedInMode1, currency)}.`);
    }
  };

  const handleSetExactFairShare = (personId: string) => {
    setContributions((prev) => ({
      ...prev,
      [personId]: fairSharePerPerson.toString(),
    }));
  };

  const handleAddQuickPurchase = () => {
    const newId = generateId();
    newlyAddedIdRef.current = newId;
    const nextIdx = purchases.length + 1;

    setPurchases((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        amount: '',
        payerIds: [participants[0]?.id || ''],
        payerMode: 'single',
        paidBy: participants[0]?.id || '',
        payers: {},
        assignedTo: participants.map((p) => p.id),
        isPayersExpanded: false,
      },
    ]);

    onShowToast(`Se agregó la Compra #${nextIdx}`);

    setTimeout(() => {
      if (purchasesContainerRef.current) {
        purchasesContainerRef.current.scrollTo({
          top: purchasesContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
      const el = document.getElementById(`purchase-name-${newId}`);
      if (el) {
        el.focus();
      }
    }, 100);
  };

  const handleRemoveQuickPurchase = (id: string) => {
    if (purchases.length === 1) {
      onShowToast('Debes tener al menos una compra en la lista.');
      return;
    }
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateQuickPurchase = (id: string, updates: Partial<QuickPurchaseItem>) => {
    setPurchases((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const togglePurchasePayer = (purchaseId: string, personId: string) => {
    setPurchases((prev) =>
      prev.map((item) => {
        if (item.id !== purchaseId) return item;
        const currentPayerIds = item.payerIds || [];
        const isAlreadyPayer = currentPayerIds.includes(personId);
        let nextPayerIds: string[];
        const nextPayers = { ...item.payers };

        if (isAlreadyPayer) {
          nextPayerIds = currentPayerIds.filter((id) => id !== personId);
          delete nextPayers[personId];
        } else {
          nextPayerIds = [...currentPayerIds, personId];
          // If this is the only payer and item has an amount, default their contribution
          if (nextPayerIds.length === 1 && !nextPayers[personId]) {
            const itAmt = parseFloat(item.amount) || 0;
            if (itAmt > 0) {
              nextPayers[personId] = itAmt.toString();
            }
          }
        }

        return {
          ...item,
          payerIds: nextPayerIds,
          payers: nextPayers,
          paidBy: nextPayerIds[0] || participants[0]?.id || '',
          payerMode: nextPayerIds.length > 1 ? 'multi' : 'single',
        };
      })
    );
  };

  const handleSplitCostEquallyAmongPayers = (purchaseId: string) => {
    const item = purchases.find((p) => p.id === purchaseId);
    if (!item || !item.payerIds || item.payerIds.length === 0) return;
    const itAmt = round2(parseFloat(item.amount) || 0);
    if (itAmt <= 0) return;

    const count = item.payerIds.length;
    const share = round2(itAmt / count);
    const updatedPayers: Record<string, string> = {};

    item.payerIds.forEach((pId, idx) => {
      if (idx === count - 1) {
        const prevSum = share * (count - 1);
        const lastShare = round2(itAmt - prevSum);
        updatedPayers[pId] = lastShare.toString();
      } else {
        updatedPayers[pId] = share.toString();
      }
    });

    handleUpdateQuickPurchase(purchaseId, { payers: updatedPayers });
    onShowToast(`Costo de ${formatCurrency(itAmt, currency)} repartido en partes iguales entre aportantes.`);
  };

  const togglePurchaseConsumer = (purchaseId: string, personId: string) => {
    setPurchases((prev) =>
      prev.map((item) => {
        if (item.id !== purchaseId) return item;
        const exists = item.assignedTo.includes(personId);
        const updated = exists
          ? item.assignedTo.filter((id) => id !== personId)
          : [...item.assignedTo, personId];
        return {
          ...item,
          assignedTo: updated.length === 0 ? [personId] : updated,
        };
      })
    );
  };

  const toggleAllPurchaseConsumers = (purchaseId: string) => {
    setPurchases((prev) =>
      prev.map((item) => {
        if (item.id !== purchaseId) return item;
        const allSelected = item.assignedTo.length === participants.length;
        return {
          ...item,
          assignedTo: allSelected ? [participants[0]?.id || ''] : participants.map((p) => p.id),
        };
      })
    );
  };

  // Difference / Vuelto resolution in Mode 2 for a specific purchase
  const handleBakeVueltoIntoInputs = (purchaseId: string) => {
    const item = purchases.find((p) => p.id === purchaseId);
    if (!item) return;
    const analysis = analyzePurchasePayers(item, participants);
    if (analysis.vuelto <= 0.009) return;

    const updatedPayers: Record<string, string> = {};
    analysis.effectivePayers.forEach((ep) => {
      if (ep.effectiveAmount > 0) {
        updatedPayers[ep.personId] = ep.effectiveAmount.toString();
      }
    });

    handleUpdateQuickPurchase(purchaseId, { payers: updatedPayers });
    const pNames = analysis.highestPayers.map((h) => h.name).join(', ');
    onShowToast(`Se descontó el vuelto de ${formatCurrency(analysis.vuelto, currency)} a ${pNames}.`);
  };

  const handleAssignPurchaseRemainderToPerson = (purchaseId: string, personId: string, missingAmt: number) => {
    const item = purchases.find((p) => p.id === purchaseId);
    if (!item || missingAmt <= 0) return;
    const current = parseFloat(item.payers[personId]) || 0;
    const updated = round2(current + missingAmt);
    const updatedPayers = {
      ...item.payers,
      [personId]: updated.toString(),
    };
    const updatedPayerIds = (item.payerIds || []).includes(personId) ? item.payerIds : [...(item.payerIds || []), personId];
    handleUpdateQuickPurchase(purchaseId, { payers: updatedPayers, payerIds: updatedPayerIds });
    const pName = participants.find((p) => p.id === personId)?.name || '';
    onShowToast(`Se sumaron ${formatCurrency(missingAmt, currency)} al aporte de ${pName}.`);
  };

  // Generate WhatsApp summary
  const narrativeSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`*RESUMEN DE CUENTA & VACA - FAIRSHARE*`);
    lines.push(`Concepto: *${title.trim() || 'Cuenta Grande'}*`);
    lines.push(`Total de la cuenta: *${formatCurrency(currentTotalAmount, currency)}*`);
    lines.push(`Total dinero aportado: *${formatCurrency(currentTotalCollected, currency)}*`);
    lines.push(``);

    if (activeTab === 'multi_purchases') {
      lines.push(`*DESGLOSE DE COMPRAS:*`);
      purchases.forEach((p, idx) => {
        const analysis = analyzePurchasePayers(p, participants);
        if (analysis.itAmt <= 0) return;
        const assignedNames = p.assignedTo
          .map((id) => participants.find((pr) => pr.id === id)?.name || '')
          .filter(Boolean)
          .join(', ');

        lines.push(`- *Compra #${idx + 1} (${p.name.trim() || 'Ítem'} - ${formatCurrency(analysis.itAmt, currency)})*:`);
        if (analysis.vuelto > 0.009) {
          lines.push(`  💰 Vuelto de ${formatCurrency(analysis.vuelto, currency)} recae en: ${analysis.highestPayers.map((h) => h.name).join(', ')}`);
        }
        const payersDesc = analysis.effectivePayers
          .map((ep) => `${ep.name}: ${formatCurrency(ep.effectiveAmount, currency)}`)
          .join(', ');
        lines.push(`  Pagaron neto: ${payersDesc || 'Sin asignar'}`);
        lines.push(`  Consumieron: ${assignedNames}`);
      });
      lines.push(``);
    }

    lines.push(`*¿QUÉ PASÓ CON EL DINERO? (DIAGNÓSTICO):*`);

    currentBalances.forEach((b) => {
      let veredicto = 'Al día ($0.00)';
      if (b.net > 0.009) {
        veredicto = `Puso +${formatCurrency(b.net, currency)} de más -> Debe RECIBIR ${formatCurrency(b.net, currency)}`;
      } else if (b.net < -0.009) {
        veredicto = `Le faltó poner -${formatCurrency(Math.abs(b.net), currency)} -> Debe PAGAR ${formatCurrency(Math.abs(b.net), currency)}`;
      }
      lines.push(`- *${b.person?.name || 'Participante'}*: Consumió ${formatCurrency(b.consumed, currency)} | Puso ${formatCurrency(b.paid, currency)} -> *${veredicto}*`);
    });

    lines.push(``);
    lines.push(`*¿QUIÉN LE DEBE PAGAR A QUIÉN?:*`);
    if (calculatedSettlements.length === 0) {
      lines.push(`¡Todas las cuentas están 100% equilibradas! Nadie le debe a nadie.`);
    } else {
      lines.push(`💳 *Opción Transferencia Digital (Exacto al centavo)*:`);
      calculatedSettlements.forEach((s) => {
        lines.push(`👉 *${s.fromPerson?.name || 'Participante'}* transfiere *${formatCurrency(s.amount, currency)}* a *${s.toPerson?.name || 'Participante'}*`);
      });

      if (cashSummary) {
        lines.push(``);
        lines.push(`💵 *En Efectivo (Aproximado Justo en Monedas)*:`);
        cashSummary.details.forEach((d) => {
          const diffText = d.difference > 0.009
            ? ` (+${formatCurrency(d.difference, currency)} diferencia)`
            : d.difference < -0.009
              ? ` (-${formatCurrency(Math.abs(d.difference), currency)} diferencia)`
              : ` (exacto)`;
          lines.push(`👉 *${d.fromPerson?.name || 'Participante'}* entrega *${formatCurrency(d.cashAmount, currency)}* a *${d.toPerson?.name || 'Participante'}*${diffText}`);
        });

        if (Math.abs(cashSummary.totalSurplus) > 0.009) {
          lines.push(`ℹ️ Diferencia en efectivo: ${cashSummary.totalSurplus > 0 ? '+' : ''}${formatCurrency(cashSummary.totalSurplus, currency)} (casi no se cuenta; propina o a favor de quien cobra)`);
        }
      }
    }

    lines.push(``);
    lines.push(`Resuelto automáticamente con FairShare`);
    return lines.join('\n');
  }, [title, activeTab, purchases, currentTotalAmount, currentTotalCollected, currency, currentBalances, calculatedSettlements, cashSummary, participants]);

  const handleCopyWhatsApp = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(narrativeSummary);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = narrativeSummary;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      onShowToast('Resumen copiado al portapapeles para WhatsApp.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onShowToast('No se pudo copiar automáticamente.');
    }
  };

  const handleSaveToEvent = () => {
    if (currentTotalAmount <= 0) {
      onShowToast('El monto total debe ser mayor a 0.');
      return;
    }

    if (activeTab === 'single_bill') {
      const payersList: ExpensePayer[] = participants
        .map((p) => ({
          personId: p.id,
          amount: round2(parseFloat(contributions[p.id]) || 0),
        }))
        .filter((p) => p.amount > 0);

      const primaryPayer = payersList[0]?.personId || participants[0]?.id || '';

      onSaveExpense({
        title: title.trim() || 'Cuenta de Mesa / Salida',
        amount: parsedTotalBill,
        paidBy: primaryPayer,
        splitAmong: targetConsumers,
        category,
        date: new Date().toISOString().split('T')[0],
        splitType: 'equal',
        payers: payersList.length > 0 ? payersList : [{ personId: primaryPayer, amount: parsedTotalBill }],
        notes: `Cuenta grande resuelta con el Asistente de Vaca. Total recaudado: ${formatCurrency(totalCollectedInMode1, currency)}.`,
      });
    } else {
      // Save multi-purchases as an itemized expense
      const itemsList: ExpenseItem[] = purchases
        .filter((p) => (parseFloat(p.amount) || 0) > 0)
        .map((p) => {
          const itAmt = round2(parseFloat(p.amount) || 0);
          const analysis = analyzePurchasePayers(p, participants);
          const itemPayers: ExpensePayer[] = analysis.effectivePayers
            .filter((ep) => ep.effectiveAmount > 0)
            .map((ep) => ({
              personId: ep.personId,
              amount: ep.effectiveAmount,
            }));

          const primaryPayer = itemPayers[0]?.personId || p.paidBy || participants[0]?.id || '';

          return {
            id: p.id,
            name: p.name.trim() || 'Compra',
            amount: itAmt,
            assignedTo: p.assignedTo.length > 0 ? p.assignedTo : participants.map((pr) => pr.id),
            paidBy: primaryPayer,
            payers: itemPayers,
          };
        });

      // Aggregate overall effective payers across all purchases
      const payerMap: Record<string, number> = {};
      itemsList.forEach((it) => {
        if (it.payers && it.payers.length > 0) {
          it.payers.forEach((pr) => {
            payerMap[pr.personId] = (payerMap[pr.personId] || 0) + pr.amount;
          });
        } else if (it.paidBy) {
          payerMap[it.paidBy] = (payerMap[it.paidBy] || 0) + it.amount;
        }
      });

      const payersList: ExpensePayer[] = Object.entries(payerMap).map(([pId, amt]) => ({
        personId: pId,
        amount: round2(amt),
      }));

      const primaryPayer = payersList[0]?.personId || participants[0]?.id || '';

      onSaveExpense({
        title: title.trim() || 'Compras Múltiples',
        amount: totalPurchasesAmount,
        paidBy: primaryPayer,
        splitAmong: Array.from(new Set(itemsList.flatMap((it) => it.assignedTo))),
        category,
        date: new Date().toISOString().split('T')[0],
        splitType: 'items',
        items: itemsList,
        payers: payersList.length > 0 ? payersList : [{ personId: primaryPayer, amount: totalPurchasesAmount }],
        notes: `Compras múltiples resueltas con Vaca: vueltos asignados a quien puso más y consumos repartidos equitativamente.`,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-dialog modal-lg smart-split-modal animate-slide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-inputs)',
                background: 'var(--color-ink)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '1.08rem' }}>
                Asistente de Cuenta Grande & Vaca
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-slate)' }}>
                Resuelve cuentas disparejas: quién le paga a quién y qué pasó con todo el dinero.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowExplanation(!showExplanation)}
              title="¿Cómo funciona la matemática de la vaca?"
              style={{ padding: '6px', color: 'var(--color-slate)' }}
            >
              <HelpCircle size={16} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ gap: '16px', padding: '16px 20px' }}>
          {/* Explanation Banner (Collapsible) */}
          {showExplanation && (
            <div className="info-banner animate-fade" style={{ background: '#f8fafc', borderColor: 'var(--color-silver)' }}>
              <Info size={16} style={{ flexShrink: 0, color: 'var(--color-ink)' }} />
              <div style={{ fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
                <strong>¿Cómo se determina quién paga qué cosa?</strong>
                <p style={{ margin: '3px 0 0 0' }}>
                  La cuenta ya fue pagada al negocio. FairShare compara lo que a cada uno le correspondía consumir (<strong>Debe</strong>) contra lo que puso de su bolsillo (<strong>Haber</strong>). Quien puso de más recibe dinero, y a quien le faltó pone su diferencia. Luego el sistema cruza los saldos para que se hagan las transferencias mínimas sin enredos.
                </p>
              </div>
            </div>
          )}

          {/* Tab Selector: Single Bill vs Multi Purchases */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${activeTab === 'single_bill' ? 'active' : ''}`}
              onClick={() => setActiveTab('single_bill')}
            >
              <Receipt size={14} />
              <span>Cuenta de Mesa / Total Directo</span>
            </button>

            <button
              type="button"
              className={`segmented-btn ${activeTab === 'multi_purchases' ? 'active' : ''}`}
              onClick={() => setActiveTab('multi_purchases')}
            >
              <ShoppingBag size={14} />
              <span>Compras Múltiples de Varios</span>
            </button>
          </div>

          {/* Description input with clean placeholder */}
          <div className="form-group">
            <label className="form-label">Nombre o Concepto del Gasto</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cuenta Cena Asado, Bar sábado, Supermercado..."
            />
          </div>

          {/* ========================================================= */}
          {/* MODO 1: CUENTA DE MESA (EJ: $100.53) */}
          {/* ========================================================= */}
          {activeTab === 'single_bill' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Total Amount Input & Fair Share Badge with clean placeholder */}
              <div 
                style={{
                  background: 'var(--color-silver-light)',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-inputs)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-slate)', textTransform: 'uppercase' }}>
                    Total de la Cuenta ({currency})
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-ink)' }}>{currency}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={totalBillAmount}
                      onChange={(e) => setTotalBillAmount(e.target.value)}
                      placeholder="0.00 (ej: 100.53)"
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        width: '150px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-inputs)',
                        border: '1px solid var(--color-silver)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>Cuota justa por persona:</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    {formatCurrency(fairSharePerPerson, currency)} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-slate)' }}>c/u</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>
                    ({activeConsumerCount} de {participants.length} personas seleccionadas)
                  </span>
                </div>
              </div>

              {/* Colorful & Explanatory Consumer Selector */}
              <div 
                style={{
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-inputs)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Info size={14} style={{ color: 'var(--color-ink)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--color-graphite)', lineHeight: '1.4' }}>
                    <strong>¿Quiénes consumieron?:</strong> El costo se divide en partes iguales únicamente entre las personas que tengan su color activado. Los desactivados (en blanco) no pagarán nada.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setBillConsumers(
                        billConsumers.length === participants.length
                          ? [participants[0]?.id || '']
                          : participants.map((p) => p.id)
                      )
                    }
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    {billConsumers.length === participants.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>

                  {participants.map((p) => {
                    const isSelected = billConsumers.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setBillConsumers((prev) => {
                            if (prev.includes(p.id)) {
                              return prev.length > 1 ? prev.filter((id) => id !== p.id) : prev;
                            } else {
                              return [...prev, p.id];
                            }
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pills)',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          backgroundColor: isSelected ? p.color : '#ffffff',
                          borderColor: isSelected ? p.color : 'var(--color-silver)',
                          borderWidth: '1.5px',
                          borderStyle: 'solid',
                          color: isSelected ? '#ffffff' : 'var(--color-graphite)',
                          boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                        }}
                      >
                        <div
                          className="avatar-circle"
                          style={{
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : p.color,
                            width: 16,
                            height: 16,
                            fontSize: '8px',
                            color: '#ffffff',
                          }}
                        >
                          {isSelected ? <Check size={10} strokeWidth={3} /> : getInitials(p.name)}
                        </div>
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Who put money at the table (La Vaca) */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                    <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> ¿Quiénes y cuánto dinero pusieron en la mesa?
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                    Aportes reales en efectivo o transferencia
                  </span>
                </div>

                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'var(--color-silver-light)',
                    border: '1px solid var(--color-silver)',
                    borderRadius: 'var(--radius-inputs)',
                    padding: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {participants.map((person) => {
                    const val = contributions[person.id] || '';
                    const numVal = parseFloat(val) || 0;
                    return (
                      <div
                        key={person.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          background: 'var(--color-white)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-inputs)',
                          border: '1px solid var(--color-silver)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
                          <div
                            className="avatar-circle"
                            style={{ backgroundColor: person.color, width: 22, height: 22, fontSize: '9px', color: '#fff' }}
                          >
                            {getInitials(person.name)}
                          </div>
                          <span style={{ fontSize: '12.5px', fontWeight: 500 }}>{person.name}</span>
                        </div>

                        {/* Quick preset buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleSetExactFairShare(person.id)}
                            style={{ fontSize: '10px', padding: '2px 5px', color: 'var(--color-slate)' }}
                            title={`Puso su cuota exacta (${formatCurrency(fairSharePerPerson, currency)})`}
                          >
                            Cuota
                          </button>
                        </div>

                        {/* Amount input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>{currency}</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={val}
                            onChange={(e) =>
                              setContributions((prev) => ({ ...prev, [person.id]: e.target.value }))
                            }
                            placeholder="0.00"
                            style={{
                              width: '85px',
                              padding: '4px 6px',
                              fontSize: '12px',
                              textAlign: 'right',
                              borderRadius: 'var(--radius-inputs)',
                              border: numVal > 0 ? '1px solid var(--color-ink)' : '1px solid var(--color-silver)',
                              fontWeight: numVal > 0 ? 600 : 400,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Money status tracker banner & 1-click difference solver */}
                <div
                  style={{
                    marginTop: '6px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-inputs)',
                    border: '1px solid',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    borderColor: Math.abs(billDiff) < 0.01 ? 'var(--color-success-border)' : '#fde047',
                    background: Math.abs(billDiff) < 0.01 ? 'var(--color-success-bg)' : '#fefce8',
                    color: Math.abs(billDiff) < 0.01 ? 'var(--color-success)' : '#854d0e',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {Math.abs(billDiff) < 0.01 && parsedTotalBill > 0 ? (
                        <>
                          <CheckCircle2 size={15} color="var(--color-success)" />
                          <span><strong>¡Aportes exactos!</strong> Los aportes suman {formatCurrency(totalCollectedInMode1, currency)}, igual al total.</span>
                        </>
                      ) : billDiff > 0 ? (
                        <>
                          <AlertCircle size={15} />
                          <span>
                            Aportado en la mesa: <strong>{formatCurrency(totalCollectedInMode1, currency)}</strong> de {formatCurrency(parsedTotalBill, currency)} (Faltan {formatCurrency(billDiff, currency)})
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={15} />
                          <span>
                            Aportado en la mesa: <strong>{formatCurrency(totalCollectedInMode1, currency)}</strong> (Supera el total por {formatCurrency(Math.abs(billDiff), currency)})
                          </span>
                        </>
                      )}
                    </div>

                    {billDiff > 0.009 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleSyncBillToCollected}
                        style={{ fontSize: '11px', textDecoration: 'underline', padding: '0 4px', color: 'inherit' }}
                      >
                        Ajustar total a lo puesto ({formatCurrency(totalCollectedInMode1, currency)})
                      </button>
                    )}
                  </div>

                  {/* 1-Click resolver: Who covered the rest with card? */}
                  {billDiff > 0.009 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px dashed #facc15' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>
                        <CreditCard size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                        ¿Quién pasó la tarjeta / pagó los {formatCurrency(billDiff, currency)} restantes?:
                      </span>
                      {participants.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAssignRemainderToPerson(p.id)}
                          style={{ fontSize: '10.5px', padding: '2px 6px', height: 'auto' }}
                        >
                          +{p.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleDistributeRemainderEqually}
                        style={{ fontSize: '10.5px', padding: '2px 6px', color: 'inherit' }}
                        title="Repartir el faltante entre todos por igual"
                      >
                        <Scale size={11} style={{ display: 'inline', marginRight: '2px' }} /> Repartir entre todos
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODO 2: COMPRAS MÚLTIPLES (EJ: 25, 35...) */}
          {/* ========================================================= */}
          {activeTab === 'multi_purchases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-graphite)' }}>
                  Compras u objetos pagados por el grupo ({purchases.length}):
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddQuickPurchase}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  <Plus size={12} />
                  <span>Agregar Compra</span>
                </button>
              </div>

              <div
                ref={purchasesContainerRef}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  maxHeight: '440px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  paddingBottom: '6px',
                }}
              >
                {purchases.map((item, idx) => {
                  const analysis = analyzePurchasePayers(item, participants);
                  const itAmt = analysis.itAmt;

                  return (
                    <div
                      key={item.id}
                      id={`purchase-card-${item.id}`}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderLeft: '5px solid var(--color-ink)',
                        borderRadius: '10px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Card Header Bar: Compra #X, Title / amount summary, and Delete Button */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: 'var(--color-ink)',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              letterSpacing: '0.5px',
                            }}
                          >
                            COMPRA #{idx + 1}
                          </span>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-graphite)' }}>
                            {item.name.trim() || 'Sin descripción aún'}
                          </span>
                          {itAmt > 0 && (
                            <span style={{ fontSize: '11px', color: 'var(--color-slate)', fontWeight: 500 }}>
                              • {formatCurrency(itAmt, currency)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemoveQuickPurchase(item.id)}
                          style={{ padding: '3px 6px', color: 'var(--color-danger)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Eliminar esta compra"
                        >
                          <Trash2 size={13} />
                          <span>Eliminar</span>
                        </button>
                      </div>

                      {/* Inputs row with clear labels: "¿Qué se compró?" and "Costo total ($)" */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', alignItems: 'end' }}>
                        <div>
                          <label
                            htmlFor={`purchase-name-${item.id}`}
                            style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-slate)', marginBottom: '4px' }}
                          >
                            ¿Qué se compró?
                          </label>
                          <input
                            id={`purchase-name-${item.id}`}
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateQuickPurchase(item.id, { name: e.target.value })}
                            placeholder="ej: Carne, Pizza, Cerveza..."
                            style={{ width: '100%', padding: '6px 10px', fontSize: '12.5px' }}
                          />
                        </div>

                        <div>
                          <label
                            style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-slate)', marginBottom: '4px', textAlign: 'right' }}
                          >
                            Costo total ({currency})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.amount}
                            onChange={(e) => handleUpdateQuickPurchase(item.id, { amount: e.target.value })}
                            placeholder="0.00"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', textAlign: 'right', fontWeight: 700 }}
                          />
                        </div>
                      </div>

                      {/* Section: ¿Quién aportó dinero para este ítem? */}
                      <div 
                        style={{
                          background: 'var(--color-silver-light)',
                          border: '1px solid var(--color-silver)',
                          borderRadius: 'var(--radius-inputs)',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <DollarSign size={13} style={{ color: 'var(--color-ink)' }} />
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-graphite)' }}>
                              ¿Quién aportó dinero para esta compra?
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>
                              (Marca solo a quienes pusieron dinero)
                            </span>
                          </div>

                          {(item.payerIds || []).length > 1 && itAmt > 0 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleSplitCostEquallyAmongPayers(item.id)}
                              style={{ fontSize: '10.5px', padding: '1px 6px', color: 'var(--color-ink)' }}
                              title="Dividir el costo en partes iguales entre los aportantes marcados"
                            >
                              <Scale size={11} style={{ display: 'inline', marginRight: '3px' }} />
                              Repartir aporte equitativo
                            </button>
                          )}
                        </div>

                        {/* Chips para seleccionar aportantes */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {participants.map((p) => {
                            const isSelected = (item.payerIds || []).includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => togglePurchasePayer(item.id, p.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-pills)',
                                  fontSize: '11px',
                                  fontWeight: isSelected ? 600 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  backgroundColor: isSelected ? p.color : '#ffffff',
                                  borderColor: isSelected ? p.color : 'var(--color-silver)',
                                  borderWidth: '1.5px',
                                  borderStyle: 'solid',
                                  color: isSelected ? '#ffffff' : 'var(--color-graphite)',
                                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                }}
                                title={isSelected ? `Quitar a ${p.name} de aportantes` : `Marcar a ${p.name} como aportante`}
                              >
                                <div
                                  className="avatar-circle"
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : p.color,
                                    width: 14,
                                    height: 14,
                                    fontSize: '7.5px',
                                    color: '#ffffff',
                                  }}
                                >
                                  {isSelected ? <Check size={8} strokeWidth={3} /> : getInitials(p.name)}
                                </div>
                                <span>{p.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Inputs de montos: SOLO para los aportantes seleccionados */}
                        {(item.payerIds || []).length === 0 ? (
                          <div style={{ fontSize: '11px', color: '#b45309', background: '#fefce8', padding: '4px 8px', borderRadius: 'var(--radius-inputs)' }}>
                            ⚠️ Selecciona arriba quién o quiénes pusieron dinero para esta compra.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px dashed var(--color-silver)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                              {(item.payerIds || []).map((pId) => {
                                const person = participants.find((p) => p.id === pId);
                                if (!person) return null;
                                const val = item.payers[pId] !== undefined ? item.payers[pId] : '';
                                return (
                                  <div
                                    key={pId}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      background: '#ffffff',
                                      border: '1px solid var(--color-silver)',
                                      borderRadius: 'var(--radius-inputs)',
                                      padding: '4px 8px',
                                      fontSize: '11.5px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <div
                                        className="avatar-circle"
                                        style={{ backgroundColor: person.color, width: 16, height: 16, fontSize: '8px', color: '#fff' }}
                                      >
                                        {getInitials(person.name)}
                                      </div>
                                      <span style={{ fontWeight: 600 }}>{person.name}</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>{currency}</span>
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={val}
                                        onChange={(e) => {
                                          const nextPayers = { ...item.payers, [pId]: e.target.value };
                                          handleUpdateQuickPurchase(item.id, { payers: nextPayers });
                                        }}
                                        placeholder={itAmt > 0 && (item.payerIds || []).length === 1 ? itAmt.toString() : '0.00'}
                                        style={{ width: '68px', padding: '2px 5px', fontSize: '11.5px', textAlign: 'right', fontWeight: 600 }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Vuelto & Remainder status banner for this purchase */}
                            {itAmt > 0 && (
                              <div style={{ marginTop: '2px' }}>
                                {analysis.vuelto > 0.009 ? (
                                  <div
                                    style={{
                                      background: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      borderRadius: 'var(--radius-inputs)',
                                      padding: '6px 10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: '6px',
                                    }}
                                  >
                                    <div style={{ fontSize: '11px', color: '#0369a1' }}>
                                      <div>
                                        Entregaron <strong>{formatCurrency(analysis.rawTotalPaid, currency)}</strong> para un costo de <strong>{formatCurrency(itAmt, currency)}</strong>.
                                      </div>
                                      <div style={{ fontWeight: 600, marginTop: '2px' }}>
                                        💰 Vuelto de {formatCurrency(analysis.vuelto, currency)} le recae a {analysis.highestPayers.map((h) => h.name).join(', ')} (puso más dinero). Su aporte neto queda en {analysis.highestPayers.map((h) => `${h.name}: ${formatCurrency(analysis.effectivePayers.find((ep) => ep.personId === h.personId)?.effectiveAmount || 0, currency)}`).join(', ')}.
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleBakeVueltoIntoInputs(item.id)}
                                      style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                      title="Ajustar los números en las casillas descontando el vuelto"
                                    >
                                      Ajustar en casillas
                                    </button>
                                  </div>
                                ) : analysis.missingAmount > 0.009 ? (
                                  <div
                                    style={{
                                      background: '#fefce8',
                                      border: '1px solid #fde047',
                                      borderRadius: 'var(--radius-inputs)',
                                      padding: '6px 10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: '6px',
                                    }}
                                  >
                                    <span style={{ fontSize: '11px', color: '#854d0e', fontWeight: 600 }}>
                                      ⚠️ Faltan {formatCurrency(analysis.missingAmount, currency)} para cubrir esta compra:
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                      {participants.map((pr) => (
                                        <button
                                          key={pr.id}
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => handleAssignPurchaseRemainderToPerson(item.id, pr.id, analysis.missingAmount)}
                                          style={{ fontSize: '10px', padding: '1px 6px', border: '1px solid var(--color-silver)' }}
                                        >
                                          +{pr.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                                    ✓ Aportes cubren exactamente {formatCurrency(itAmt, currency)}.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Colorful Consumer selector for this purchase */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Info size={13} style={{ color: 'var(--color-ink)', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: 'var(--color-graphite)', fontWeight: 600 }}>
                              ¿Quiénes consumieron este ítem? (Se divide únicamente entre los que tengan su color activado):
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleAllPurchaseConsumers(item.id)}
                            style={{ fontSize: '10px', padding: '1px 6px' }}
                          >
                            {item.assignedTo.length === participants.length ? 'Desmarcar todos' : 'Marcar todos'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {participants.map((p) => {
                            const isSelected = item.assignedTo.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => togglePurchaseConsumer(item.id, p.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-pills)',
                                  fontSize: '11px',
                                  fontWeight: isSelected ? 600 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  backgroundColor: isSelected ? p.color : '#ffffff',
                                  borderColor: isSelected ? p.color : 'var(--color-silver)',
                                  borderWidth: '1.5px',
                                  borderStyle: 'solid',
                                  color: isSelected ? '#ffffff' : 'var(--color-graphite)',
                                }}
                              >
                                <div
                                  className="avatar-circle"
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : p.color,
                                    width: 14,
                                    height: 14,
                                    fontSize: '7px',
                                    color: '#ffffff',
                                  }}
                                >
                                  {isSelected ? <Check size={8} strokeWidth={3} /> : getInitials(p.name)}
                                </div>
                                <span>{p.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Botón destacado al final de la lista para agregar más compras */}
                <button
                  type="button"
                  onClick={handleAddQuickPurchase}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    border: '2px dashed #cbd5e1',
                    background: 'rgba(255, 255, 255, 0.75)',
                    color: 'var(--color-ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-ink)';
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.75)';
                  }}
                >
                  <Plus size={14} />
                  <span>+ Agregar otra compra u objeto (Compra #{purchases.length + 1})</span>
                </button>
              </div>

              {/* Total purchases footer */}
              <div 
                style={{
                  background: 'var(--color-silver-light)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-inputs)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <span>Total de las compras:</span>
                <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>
                  {formatCurrency(totalPurchasesAmount, currency)}
                </strong>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECCIÓN DE AUDITORÍA: ¿QUÉ PASÓ CON TODO EL DINERO? */}
          {/* ========================================================= */}
          <div 
            style={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-silver)',
              borderRadius: 'var(--radius-cards)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="var(--color-ink)" />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-ink)' }}>
                  Diagnóstico: ¿Qué pasó con el dinero?
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                Consumo vs Lo que puso cada persona
              </span>
            </div>

            {/* Audit Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {currentBalances.map(({ person, consumed, paid, net }) => (
                <div
                  key={person.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-inputs)',
                    background: 'var(--color-white)',
                    border: '1px solid var(--color-silver)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: person?.color || 'var(--color-ink)', width: 22, height: 22, fontSize: '9px', color: '#fff' }}
                    >
                      {getInitials(person?.name || '?')}
                    </div>
                    <span style={{ fontWeight: 600 }}>{person?.name || 'Participante'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-slate)', textAlign: 'right' }}>
                      <span>Le correspondió: {formatCurrency(consumed, currency)}</span>
                      <span style={{ margin: '0 4px' }}>|</span>
                      <span>Aportó: {formatCurrency(paid, currency)}</span>
                    </div>

                    <span
                      className={`badge-balance ${
                        net > 0.009 ? 'badge-positive' : net < -0.009 ? 'badge-negative' : 'badge-neutral'
                      }`}
                      style={{ minWidth: '135px', justifyContent: 'center' }}
                    >
                      {net > 0.009
                        ? `Aportó +${formatCurrency(net, currency)} (Recibe)`
                        : net < -0.009
                        ? `Le faltó -${formatCurrency(Math.abs(net), currency)} (Debe)`
                        : 'Al día ($0.00)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECCIÓN DE RESOLUCIÓN: ¿QUIÉN LE DEBE PAGAR A QUIÉN? */}
          {/* ========================================================= */}
          <div 
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-silver)',
              borderRadius: 'var(--radius-cards)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--color-success)" />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-ink)' }}>
                  ¿Quién le debe pagar a quién y cuánto?
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                Transferencias directas para saldar la cuenta
              </span>
            </div>

            {calculatedSettlements.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Toggle: Transferencia vs Efectivo */}
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '6px', 
                    background: 'var(--color-silver-light)', 
                    padding: '3px', 
                    borderRadius: 'var(--radius-inputs)' 
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSettleMethod('transfer')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '11.5px',
                      background: settleMethod === 'transfer' ? '#ffffff' : 'transparent',
                      color: settleMethod === 'transfer' ? 'var(--color-ink)' : 'var(--color-slate)',
                      boxShadow: settleMethod === 'transfer' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <CreditCard size={13} />
                    <span>Transferencia (Exacto)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleMethod('cash')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '11.5px',
                      background: settleMethod === 'cash' ? '#ffffff' : 'transparent',
                      color: settleMethod === 'cash' ? 'var(--color-ink)' : 'var(--color-slate)',
                      boxShadow: settleMethod === 'cash' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <Coins size={13} />
                    <span>Efectivo (Aproximado Justo)</span>
                  </button>
                </div>

                {/* Banner explicativo de Aproximado Justo en Efectivo */}
                {settleMethod === 'cash' && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '4px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-graphite)' }}>
                      <Coins size={13} style={{ color: 'var(--color-ink)' }} />
                      <span>
                        <strong>Aproximado justo en efectivo:</strong> Calculado con monedas reales para evitar dar centavos no comunes (como 2 o 3¢).
                      </span>
                    </div>

                    {Math.abs(cashSummary.totalSurplus) > 0.009 ? (
                      <span style={{ fontSize: '10.5px', color: cashSummary.totalSurplus > 0 ? 'var(--color-success)' : '#b45309', fontWeight: 600 }}>
                        {cashSummary.totalSurplus > 0
                          ? `+${formatCurrency(cashSummary.totalSurplus, currency)} diferencia (propina / cambio)`
                          : `-${formatCurrency(Math.abs(cashSummary.totalSurplus), currency)} ajuste`}
                      </span>
                    ) : (
                      <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>Exacto en monedas</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {calculatedSettlements.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--color-slate)' }}>
                {currentTotalAmount <= 0
                  ? 'Ingresa el monto de la cuenta y los aportes para calcular los pagos.'
                  : '¡Cuentas perfectamente equilibradas! No se requieren transferencias.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {calculatedSettlements.map((tx) => {
                  const cashDetail = cashSummary.details.find((d) => d.transactionId === tx.id);
                  const displayAmount = settleMethod === 'cash' && cashDetail ? cashDetail.cashAmount : tx.amount;
                  const hasDiff = settleMethod === 'cash' && cashDetail && Math.abs(cashDetail.difference) > 0.009;

                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--color-silver-light)',
                        border: '1px solid var(--color-silver)',
                        borderRadius: 'var(--radius-inputs)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          className="avatar-circle"
                          style={{ backgroundColor: tx.fromPerson?.color || 'var(--color-ink)', width: 22, height: 22, fontSize: '9px', color: '#fff' }}
                        >
                          {getInitials(tx.fromPerson?.name || '?')}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{tx.fromPerson?.name || 'Participante'}</span>
                        <ArrowRight size={13} style={{ color: 'var(--color-slate)', flexShrink: 0 }} />
                        <div
                          className="avatar-circle"
                          style={{ backgroundColor: tx.toPerson?.color || 'var(--color-ink)', width: 22, height: 22, fontSize: '9px', color: '#fff' }}
                        >
                          {getInitials(tx.toPerson?.name || '?')}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{tx.toPerson?.name || 'Participante'}</span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--color-ink)', display: 'block' }}>
                          {formatCurrency(displayAmount, currency)}
                        </strong>
                        <div style={{ fontSize: '10px', color: 'var(--color-slate)' }}>
                          {settleMethod === 'transfer' ? (
                            'Transferencia exacta'
                          ) : hasDiff && cashDetail ? (
                            cashDetail.difference > 0 ? (
                              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                                Exacto: {formatCurrency(cashDetail.exactAmount, currency)} (+{formatCurrency(cashDetail.difference, currency)} en monedas)
                              </span>
                            ) : (
                              <span style={{ color: '#b45309', fontWeight: 600 }}>
                                Exacto: {formatCurrency(cashDetail.exactAmount, currency)} (-{formatCurrency(Math.abs(cashDetail.difference), currency)} ajuste)
                              </span>
                            )
                          ) : (
                            'Exacto en monedas'
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyWhatsApp}
            title="Copiar desglose completo para enviar por WhatsApp"
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveToEvent}
            >
              <Check size={14} />
              <span>Guardar en el Evento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
