import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  DollarSign, 
  Calendar, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  HelpCircle, 
  Sparkles, 
  AlertCircle, 
  ShoppingBag, 
  Equal, 
  CheckCircle2
} from 'lucide-react';
import type { 
  Expense, 
  ExpenseCategory, 
  Person, 
  SplitType, 
  ExpenseItem 
} from '../types/fairshare';
import { CATEGORIES } from '../types/fairshare';
import { CategoryIcon } from './CategoryIcon';
import { getInitials, generateId } from '../services/storage';
import { formatCurrency, round2 } from '../utils/settlement';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>, editId?: string) => void;
  participants: Person[];
  currency: string;
  expenseToEdit?: Expense | null;
  onOpenSmartSplit?: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  currency,
  expenseToEdit,
  onOpenSmartSplit,
}) => {
  // General details
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Split mode: 'equal' | 'items' | 'exact'
  const [splitType, setSplitType] = useState<SplitType>('equal');

  // Equal split
  const [splitAmong, setSplitAmong] = useState<string[]>([]);

  // Itemized split
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [extraFee, setExtraFee] = useState<string>('');
  const [extraFeeSplitType, setExtraFeeSplitType] = useState<'all' | 'item_consumers'>('item_consumers');

  // Exact split
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Payment mode: 'single' (one person pays) | 'multi' (vaca / partial contributions)
  const [paymentMode, setPaymentMode] = useState<'single' | 'multi'>('single');
  const [paidBy, setPaidBy] = useState('');
  const [payers, setPayers] = useState<Record<string, string>>({});

  // Help & preview dialogs
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (expenseToEdit) {
      setTitle(expenseToEdit.title);
      setAmount(expenseToEdit.amount.toString());
      setCategory(expenseToEdit.category);
      setDate(expenseToEdit.date || new Date().toISOString().split('T')[0]);
      setNotes(expenseToEdit.notes || '');

      // Split type
      const st = expenseToEdit.splitType || 'equal';
      setSplitType(st);
      setSplitAmong(expenseToEdit.splitAmong || participants.map((p) => p.id));

      if (expenseToEdit.items && expenseToEdit.items.length > 0) {
        setItems(expenseToEdit.items);
      } else {
        setItems([
          { id: generateId(), name: 'Ítem 1', amount: expenseToEdit.amount, assignedTo: participants.map((p) => p.id) },
        ]);
      }

      setExtraFee(expenseToEdit.extraFee ? expenseToEdit.extraFee.toString() : '');
      setExtraFeeSplitType(expenseToEdit.extraFeeSplitType || 'item_consumers');

      // Exact splits
      if (expenseToEdit.customSplits && expenseToEdit.customSplits.length > 0) {
        const splitsMap: Record<string, string> = {};
        expenseToEdit.customSplits.forEach((s) => {
          splitsMap[s.personId] = s.amount.toString();
        });
        setCustomSplits(splitsMap);
      } else {
        setCustomSplits({});
      }

      // Payment mode
      if (expenseToEdit.payers && expenseToEdit.payers.length > 0) {
        setPaymentMode('multi');
        const pMap: Record<string, string> = {};
        expenseToEdit.payers.forEach((p) => {
          pMap[p.personId] = p.amount.toString();
        });
        setPayers(pMap);
        setPaidBy(expenseToEdit.payers[0]?.personId || participants[0]?.id || '');
      } else {
        setPaymentMode('single');
        setPaidBy(expenseToEdit.paidBy || participants[0]?.id || '');
        setPayers({});
      }
    } else {
      // Reset for new expense
      setTitle('');
      setAmount('');
      setCategory('food');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setSplitType('equal');
      setSplitAmong(participants.map((p) => p.id));
      setPaidBy(participants[0]?.id || '');
      setPaymentMode('single');
      setPayers({});
      setCustomSplits({});
      setExtraFee('');
      setExtraFeeSplitType('item_consumers');
      setItems([
        { id: generateId(), name: 'Plato / Ítem 1', amount: 0, assignedTo: participants.map((p) => p.id) },
      ]);
    }
    setError('');
  }, [isOpen, expenseToEdit, participants]);

  // Sync total amount with itemized items when in 'items' mode
  const totalFromItems = useMemo(() => {
    const itemsTotal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    const extra = parseFloat(extraFee) || 0;
    return round2(itemsTotal + extra);
  }, [items, extraFee]);

  // Auto-sync amount field when in items mode
  useEffect(() => {
    if (splitType === 'items') {
      setAmount(totalFromItems > 0 ? totalFromItems.toString() : '');
    }
  }, [splitType, totalFromItems]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;

  // Multi-payer total calculation
  const totalPaidInMulti = participants.reduce((acc, p) => {
    return acc + (parseFloat(payers[p.id]) || 0);
  }, 0);

  const roundedTotalPaid = round2(totalPaidInMulti);
  const paymentDiff = round2(numAmount - roundedTotalPaid);

  // Equal split share
  const splitCount = splitAmong.length;
  const perPersonShare = splitCount > 0 ? round2(numAmount / splitCount) : 0;

  // Toggle participant in equal split
  const toggleParticipantEqual = (pId: string) => {
    if (splitAmong.includes(pId)) {
      if (splitAmong.length === 1) {
        setError('Al menos una persona debe estar incluida en la división.');
        return;
      }
      setSplitAmong(splitAmong.filter((id) => id !== pId));
    } else {
      setSplitAmong([...splitAmong, pId]);
    }
    setError('');
  };

  // Item handlers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        name: `Ítem ${prev.length + 1}`,
        amount: 0,
        assignedTo: participants.map((p) => p.id),
      },
    ]);
  };

  const handleUpdateItem = (id: string, updates: Partial<ExpenseItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      setError('Debes tener al menos un ítem en la lista.');
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setError('');
  };

  const toggleItemConsumer = (itemId: string, personId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const isAssigned = item.assignedTo.includes(personId);
        const newAssigned = isAssigned
          ? item.assignedTo.filter((id) => id !== personId)
          : [...item.assignedTo, personId];
        return {
          ...item,
          assignedTo: newAssigned.length === 0 ? [personId] : newAssigned,
        };
      })
    );
  };

  const toggleAllItemConsumers = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const allSelected = item.assignedTo.length === participants.length;
        return {
          ...item,
          assignedTo: allSelected ? [participants[0].id] : participants.map((p) => p.id),
        };
      })
    );
  };

  // Auto-fill remainder in multi-payer mode
  const handleFillRemainder = (personId: string) => {
    if (paymentDiff <= 0) return;
    const current = parseFloat(payers[personId]) || 0;
    const updated = round2(current + paymentDiff);
    setPayers((prev) => ({
      ...prev,
      [personId]: updated > 0 ? updated.toString() : '',
    }));
  };

  // Adjust total bill amount to match total paid in multi-payer
  const handleSyncBillAmountToPayers = () => {
    if (roundedTotalPaid > 0) {
      setAmount(roundedTotalPaid.toString());
      setError('');
    }
  };

  // Live Balance Calculation Preview for this single expense
  const previewBalances = participants.map((person) => {
    // 1. Paid amount
    let paid = 0;
    if (paymentMode === 'multi') {
      paid = parseFloat(payers[person.id]) || 0;
    } else {
      paid = person.id === paidBy ? numAmount : 0;
    }

    // 2. Consumed / Owed amount
    let owed = 0;
    if (splitType === 'items') {
      items.forEach((item) => {
        const itemAmt = Number(item.amount) || 0;
        if (itemAmt <= 0) return;
        const assigned = item.assignedTo.length > 0 ? item.assignedTo : participants.map((p) => p.id);
        if (assigned.includes(person.id)) {
          owed += itemAmt / assigned.length;
        }
      });

      // Extra fee distribution
      const extra = parseFloat(extraFee) || 0;
      if (extra > 0) {
        if (extraFeeSplitType === 'all') {
          owed += extra / participants.length;
        } else {
          const itemConsumers = new Set(items.flatMap((it) => it.assignedTo));
          if (itemConsumers.has(person.id)) {
            owed += extra / (itemConsumers.size || 1);
          }
        }
      }
    } else if (splitType === 'exact') {
      owed = parseFloat(customSplits[person.id]) || 0;
    } else {
      // Equal split
      if (splitAmong.includes(person.id)) {
        owed = splitCount > 0 ? numAmount / splitCount : 0;
      }
    }

    const net = round2(paid - owed);

    return {
      person,
      paid: round2(paid),
      owed: round2(owed),
      net,
    };
  });

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Por favor ingresa un concepto o descripción.');
      return;
    }

    if (numAmount <= 0) {
      setError('El monto total debe ser mayor a 0.');
      return;
    }

    // Validate Payment
    let primaryPayer = paidBy;
    let payersList: { personId: string; amount: number }[] | undefined = undefined;

    if (paymentMode === 'multi') {
      payersList = participants
        .map((p) => ({
          personId: p.id,
          amount: round2(parseFloat(payers[p.id]) || 0),
        }))
        .filter((p) => p.amount > 0);

      if (payersList.length === 0) {
        setError('Debes ingresar al menos el aporte de una persona en la vaca.');
        return;
      }

      if (Math.abs(paymentDiff) > 0.05) {
        setError(
          paymentDiff > 0
            ? `Faltan ${formatCurrency(paymentDiff, currency)} para completar el total de la cuenta. Ajusta la cuenta o asigna el restante.`
            : `El total aportado supera la cuenta por ${formatCurrency(Math.abs(paymentDiff), currency)}.`
        );
        return;
      }

      primaryPayer = payersList[0].personId;
    } else {
      if (!primaryPayer) {
        setError('Selecciona quién pagó la cuenta.');
        return;
      }
    }

    // Validate Split
    let finalSplitAmong = splitAmong;
    let validItems: ExpenseItem[] | undefined = undefined;
    let customSplitsList: { personId: string; amount: number }[] | undefined = undefined;

    if (splitType === 'items') {
      validItems = items.filter((it) => (Number(it.amount) || 0) > 0);
      if (validItems.length === 0) {
        setError('Debes agregar al menos un ítem con monto mayor a 0.');
        return;
      }

      const allConsumerIds = new Set<string>();
      validItems.forEach((it) => {
        it.assignedTo.forEach((id) => allConsumerIds.add(id));
      });
      finalSplitAmong = Array.from(allConsumerIds);

      if (finalSplitAmong.length === 0) {
        setError('Cada ítem debe estar asignado al menos a un consumidor.');
        return;
      }
    } else if (splitType === 'exact') {
      customSplitsList = participants
        .map((p) => ({
          personId: p.id,
          amount: round2(parseFloat(customSplits[p.id]) || 0),
        }))
        .filter((s) => s.amount > 0);

      if (customSplitsList.length === 0) {
        setError('Ingresa el monto que consumió cada participante.');
        return;
      }

      const totalCustom = round2(customSplitsList.reduce((acc, s) => acc + s.amount, 0));
      if (Math.abs(totalCustom - numAmount) > 0.05) {
        setError(`La suma de los consumos individuales (${formatCurrency(totalCustom, currency)}) no coincide con el total (${formatCurrency(numAmount, currency)}).`);
        return;
      }

      finalSplitAmong = customSplitsList.map((s) => s.personId);
    } else {
      if (splitAmong.length === 0) {
        setError('Debes seleccionar al menos una persona que comparta el gasto.');
        return;
      }
    }

    onSave(
      {
        title: title.trim(),
        amount: numAmount,
        category,
        paidBy: primaryPayer,
        splitAmong: finalSplitAmong,
        date,
        notes: notes.trim(),
        splitType,
        payers: paymentMode === 'multi' ? payersList : undefined,
        items: splitType === 'items' ? validItems : undefined,
        customSplits: splitType === 'exact' ? customSplitsList : undefined,
        extraFee: splitType === 'items' && parseFloat(extraFee) > 0 ? parseFloat(extraFee) : undefined,
        extraFeeSplitType: splitType === 'items' ? extraFeeSplitType : undefined,
      },
      expenseToEdit?.id
    );

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="modal-title">
              {expenseToEdit ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '3px 6px', color: 'var(--color-slate)' }}
              onClick={() => setShowHelperModal(true)}
              title="¿Cómo funciona el cálculo de cuentas complejas y vacas?"
            >
              <HelpCircle size={15} />
            </button>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--color-danger-border)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-inputs)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Acceso Rápido al Asistente de Cuenta Grande / Vaca */}
            {onOpenSmartSplit && !expenseToEdit && (
              <div 
                style={{
                  background: 'var(--color-silver-light)',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-inputs)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="var(--color-ink)" />
                  <span>¿Es una cuenta grande con varios aportantes o compras múltiples?</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose();
                    onOpenSmartSplit();
                  }}
                  style={{ padding: '3px 10px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                >
                  Abrir Asistente de Vaca
                </button>
              </div>
            )}

            {/* SECCIÓN 1: DATOS GENERALES */}
            <div className="form-group">
              <label className="form-label">Concepto o Descripción *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cena restaurante, Compras asado, Supermercado..."
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">
                  <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Monto Total * ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={splitType === 'items'}
                  title={splitType === 'items' ? 'Se calcula automáticamente a partir de los ítems' : ''}
                />
                {splitType === 'items' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-slate)', marginTop: '2px', display: 'block' }}>
                    Calculado automáticamente por la suma de ítems.
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Category Grid */}
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <div className="category-grid-picker">
                {(Object.keys(CATEGORIES) as ExpenseCategory[]).map((catKey) => {
                  const cat = CATEGORIES[catKey];
                  const isSelected = category === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      className={`category-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => setCategory(catKey)}
                    >
                      <CategoryIcon category={catKey} size={15} />
                      <span>{cat.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN 2: ¿CÓMO SE DIVIDEN LOS CONSUMOS? (DEBE) */}
            <div className="form-group" style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <Users size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> ¿Cómo se divide el consumo?
                </label>
                <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                  ¿Quién debe qué cosa?
                </span>
              </div>

              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-btn ${splitType === 'equal' ? 'active' : ''}`}
                  onClick={() => setSplitType('equal')}
                >
                  <Equal size={14} />
                  <span>Partes Iguales</span>
                </button>

                <button
                  type="button"
                  className={`segmented-btn ${splitType === 'items' ? 'active' : ''}`}
                  onClick={() => setSplitType('items')}
                >
                  <ShoppingBag size={14} />
                  <span>Por Ítems / Ticket</span>
                </button>

                <button
                  type="button"
                  className={`segmented-btn ${splitType === 'exact' ? 'active' : ''}`}
                  onClick={() => setSplitType('exact')}
                >
                  <DollarSign size={14} />
                  <span>Montos Exactos</span>
                </button>
              </div>
            </div>

            {/* SUB-MODO: PARTES IGUALES */}
            {splitType === 'equal' && (
              <div
                style={{
                  background: 'var(--color-silver-light)',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-inputs)',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-graphite)' }}>
                    Participantes incluidos ({splitCount}):
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSplitAmong(participants.map((p) => p.id))}
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    Seleccionar todos
                  </button>
                </div>

                {participants.map((p) => {
                  const isIncluded = splitAmong.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleParticipantEqual(p.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-inputs)',
                        background: isIncluded ? 'var(--color-white)' : 'transparent',
                        border: isIncluded ? '1px solid var(--color-silver)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: isIncluded ? '1px solid var(--color-ink)' : '1px solid var(--color-silver)',
                            background: isIncluded ? 'var(--color-ink)' : 'var(--color-white)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                          }}
                        >
                          {isIncluded && <Check size={11} strokeWidth={3} />}
                        </div>
                        <div
                          className="avatar-circle"
                          style={{ backgroundColor: p.color, color: '#ffffff', width: 20, height: 20, fontSize: '9px' }}
                        >
                          {getInitials(p.name)}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{p.name}</span>
                      </div>

                      {isIncluded && numAmount > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--color-slate)', fontWeight: 600 }}>
                          {formatCurrency(perPersonShare, currency)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* SUB-MODO: POR ÍTEMS / TICKET DETALLADO */}
            {splitType === 'items' && (
              <div className="items-builder-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-graphite)' }}>
                    Lista de artículos o consumos:
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddItem}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    <Plus size={12} />
                    <span>Agregar Ítem</span>
                  </button>
                </div>

                {items.map((item, idx) => {
                  const assignedCount = item.assignedTo.length || participants.length;
                  const itemShare = (Number(item.amount) || 0) / assignedCount;

                  return (
                    <div key={item.id} className="item-row-card">
                      <div className="item-row-top">
                        <span style={{ fontSize: '12px', color: 'var(--color-slate)', fontWeight: 600, minWidth: '18px' }}>
                          #{idx + 1}
                        </span>

                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                          placeholder="Nombre del ítem (ej: Pizza, Hamburguesa...)"
                        />

                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="item-amount-input"
                          value={item.amount || ''}
                          onChange={(e) => handleUpdateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{ padding: '4px', color: 'var(--color-danger)' }}
                          title="Eliminar este ítem"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Consumer chips */}
                      <div className="item-consumers-picker">
                        <span style={{ fontSize: '11px', color: 'var(--color-slate)', marginRight: '2px' }}>
                          Consumido por:
                        </span>

                        <button
                          type="button"
                          className={`consumer-chip-btn ${item.assignedTo.length === participants.length ? 'selected' : ''}`}
                          onClick={() => toggleAllItemConsumers(item.id)}
                        >
                          <span>Todos</span>
                        </button>

                        {participants.map((p) => {
                          const isAssigned = item.assignedTo.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`consumer-chip-btn ${isAssigned ? 'selected' : ''}`}
                              onClick={() => toggleItemConsumer(item.id, p.id)}
                            >
                              <div
                                className="avatar-circle"
                                style={{ backgroundColor: p.color, width: 14, height: 14, fontSize: '8px', color: '#fff' }}
                              >
                                {getInitials(p.name)}
                              </div>
                              <span>{p.name}</span>
                            </button>
                          );
                        })}

                        {item.amount > 0 && assignedCount > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--color-slate)', marginLeft: 'auto', fontWeight: 600 }}>
                            {formatCurrency(itemShare, currency)} c/u
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Extra fee (propina / servicio / delivery) */}
                <div
                  style={{
                    background: 'var(--color-silver-light)',
                    border: '1px solid var(--color-silver)',
                    borderRadius: 'var(--radius-inputs)',
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>
                      + Propina, servicio o costo adicional (opcional):
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={extraFee}
                      onChange={(e) => setExtraFee(e.target.value)}
                      placeholder="0.00"
                      style={{ width: '90px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}
                    />
                  </div>

                  {parseFloat(extraFee) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-slate)' }}>
                      <span>Dividir cargo adicional entre:</span>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="extraFeeSplit"
                          checked={extraFeeSplitType === 'item_consumers'}
                          onChange={() => setExtraFeeSplitType('item_consumers')}
                        />
                        <span>Quienes consumieron ítems</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="extraFeeSplit"
                          checked={extraFeeSplitType === 'all'}
                          onChange={() => setExtraFeeSplitType('all')}
                        />
                        <span>Todos por igual</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-MODO: MONTOS EXACTOS */}
            {splitType === 'exact' && (
              <div
                style={{
                  background: 'var(--color-silver-light)',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-inputs)',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-slate)', marginBottom: '4px' }}>
                  Ingresa cuánto consumió exactamente cada persona:
                </div>

                {participants.map((p) => {
                  return (
                    <div
                      key={p.id}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          className="avatar-circle"
                          style={{ backgroundColor: p.color, color: '#ffffff', width: 22, height: 22, fontSize: '9px' }}
                        >
                          {getInitials(p.name)}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{p.name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-slate)' }}>{currency}</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={customSplits[p.id] || ''}
                          onChange={(e) =>
                            setCustomSplits((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="0.00"
                          style={{ width: '90px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SECCIÓN 3: ¿QUIÉN PAGÓ LA CUENTA? (APORTE / HABER) */}
            <div className="form-group" style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> ¿Quién pagó la cuenta?
                </label>
                <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                  ¿Quién puso el dinero?
                </span>
              </div>

              <div className="segmented-control" style={{ marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`segmented-btn ${paymentMode === 'single' ? 'active' : ''}`}
                  onClick={() => setPaymentMode('single')}
                >
                  <Users size={14} />
                  <span>Un Solo Pagador</span>
                </button>

                <button
                  type="button"
                  className={`segmented-btn ${paymentMode === 'multi' ? 'active' : ''}`}
                  onClick={() => setPaymentMode('multi')}
                >
                  <Sparkles size={14} />
                  <span>Varios Pagadores (Vaca)</span>
                </button>
              </div>

              {/* MODO SINGLE PAYER */}
              {paymentMode === 'single' ? (
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (pagó el total de {formatCurrency(numAmount, currency)})
                    </option>
                  ))}
                </select>
              ) : (
                /* MODO MULTI PAYER (VACA) */
                <div className="multi-payer-list">
                  <div style={{ fontSize: '12px', color: 'var(--color-slate)', marginBottom: '2px' }}>
                    Indica cuánto dinero aportó cada persona para pagar la cuenta:
                  </div>

                  {participants.map((p) => {
                    return (
                      <div key={p.id} className="payer-row-item">
                        <div className="payer-info-left">
                          <div
                            className="avatar-circle"
                            style={{ backgroundColor: p.color, color: '#ffffff', width: 22, height: 22, fontSize: '9px' }}
                          >
                            {getInitials(p.name)}
                          </div>
                          <span className="payer-name-text">{p.name}</span>
                        </div>

                        <div className="payer-input-right">
                          <span style={{ fontSize: '12px', color: 'var(--color-slate)' }}>{currency}</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={payers[p.id] || ''}
                            onChange={(e) =>
                              setPayers((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="0.00"
                          />

                          {paymentDiff > 0.009 && (
                            <button
                              type="button"
                              className="btn-fill-remainder"
                              onClick={() => handleFillRemainder(p.id)}
                              title={`Poner restante (${formatCurrency(paymentDiff, currency)})`}
                            >
                              + Restante
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Payment Status Tracker Banner */}
                  <div
                    className={`payment-tracker-banner ${
                      Math.abs(paymentDiff) < 0.01
                        ? 'balanced'
                        : paymentDiff > 0
                        ? 'underpaid'
                        : 'overpaid'
                    }`}
                  >
                    <div>
                      {Math.abs(paymentDiff) < 0.01 ? (
                        <span>
                          <CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                          ¡Cuenta 100% cubierta! Aportes: {formatCurrency(roundedTotalPaid, currency)}
                        </span>
                      ) : paymentDiff > 0 ? (
                        <span>
                          Aportado: <strong>{formatCurrency(roundedTotalPaid, currency)}</strong> de {formatCurrency(numAmount, currency)} (Faltan {formatCurrency(paymentDiff, currency)})
                        </span>
                      ) : (
                        <span>
                          Aportado: <strong>{formatCurrency(roundedTotalPaid, currency)}</strong> (Supera el total por {formatCurrency(Math.abs(paymentDiff), currency)})
                        </span>
                      )}
                    </div>

                    {Math.abs(paymentDiff) >= 0.01 && roundedTotalPaid > 0 && splitType !== 'items' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleSyncBillAmountToPayers}
                        style={{ fontSize: '11px', textDecoration: 'underline', padding: '2px 4px' }}
                      >
                        Ajustar total al aporte ({formatCurrency(roundedTotalPaid, currency)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 4: PREVISUALIZACIÓN DEL BALANCE DE ESTE GASTO */}
            <div className="expense-preview-section">
              <div className="expense-preview-header">
                <span>Balance instantáneo de esta cuenta:</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowLivePreview(!showLivePreview)}
                  style={{ fontSize: '11px', padding: '0 4px', textTransform: 'none' }}
                >
                  {showLivePreview ? 'Ocultar' : 'Ver detalle'}
                </button>
              </div>

              {showLivePreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {previewBalances.map(({ person, paid, owed, net }) => (
                    <div key={person.id} className="preview-participant-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          className="avatar-circle"
                          style={{ backgroundColor: person.color, color: '#ffffff', width: 18, height: 18, fontSize: '8px' }}
                        >
                          {getInitials(person.name)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{person.name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--color-slate)', fontSize: '11.5px' }}>
                          Puso: {formatCurrency(paid, currency)} | Debe: {formatCurrency(owed, currency)}
                        </span>

                        <span
                          className={`preview-balance-tag ${
                            net > 0.009 ? 'credit' : net < -0.009 ? 'debt' : 'zero'
                          }`}
                        >
                          {net > 0.009
                            ? `+ Le deben ${formatCurrency(net, currency)}`
                            : net < -0.009
                            ? `- Debe ${formatCurrency(Math.abs(net), currency)}`
                            : 'Al día ($0)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div className="form-group">
              <label className="form-label">
                <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Notas adicionales (opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles sobre pagos, propina, acuerdos..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {expenseToEdit ? 'Guardar Cambios' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>

      {/* Helper Modal: Explicación de cómo funciona el cálculo de cuentas y vacas */}
      {showHelperModal && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 60 }}
          onClick={() => setShowHelperModal(false)}
        >
          <div
            className="modal-dialog"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} />
                <span>¿Cómo calcula FairShare las vacas y cuentas complejas?</span>
              </h4>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowHelperModal(false)}
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: '13px', lineHeight: '1.6', gap: '12px' }}>
              <p>
                En una cuenta donde varios ponen dinero en efectivo o transferencia (ej. $50, $20, $10, $5, $0.53) y otros consumen cosas distintas (plato de $25, plato de $35, etc.), FairShare separa el cálculo en dos lados matemáticos exactos:
              </p>

              <div style={{ background: 'var(--color-silver-light)', padding: '10px', borderRadius: 'var(--radius-inputs)' }}>
                <strong>1. Consumo (Lo que a cada uno le corresponde pagar):</strong>
                <p style={{ marginTop: '4px', color: 'var(--color-slate)' }}>
                  Se suma el costo de cada plato o ítem entre quienes lo comieron o compartieron.
                </p>
              </div>

              <div style={{ background: 'var(--color-silver-light)', padding: '10px', borderRadius: 'var(--radius-inputs)' }}>
                <strong>2. Aporte (Lo que cada uno puso de dinero):</strong>
                <p style={{ marginTop: '4px', color: 'var(--color-slate)' }}>
                  Se anota el efectivo o transferencia que cada persona aportó a la cuenta del lugar.
                </p>
              </div>

              <div style={{ background: 'var(--color-paper)', padding: '10px', borderRadius: 'var(--radius-inputs)', borderLeft: '3px solid var(--color-ink)' }}>
                <strong>3. El Balance de cada persona:</strong>
                <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                  Saldo = Total Aportado - Total Consumido
                </div>
                <ul style={{ paddingLeft: '16px', marginTop: '6px' }}>
                  <li><strong>Saldo positivo (+):</strong> Puso más de lo que consumió → el grupo le devuelve dinero.</li>
                  <li><strong>Saldo negativo (-):</strong> Consumió más de lo que puso → debe pagar esa diferencia.</li>
                </ul>
              </div>

              <p style={{ color: 'var(--color-slate)' }}>
                Finalmente, FairShare calcula automáticamente las <strong>transferencias mínimas</strong> entre quienes quedaron debiendo y quienes pusieron de más para que nadie tenga que hacer cálculos manuales.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowHelperModal(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
