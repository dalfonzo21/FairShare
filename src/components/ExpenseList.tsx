import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Filter, 
  Calendar, 
  Layers,
  CalendarDays,
  List,
  ShoppingBag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowRight,
  Share2,
  Check
} from 'lucide-react';
import type { Expense, ExpenseCategory, Person } from '../types/fairshare';
import { CATEGORIES } from '../types/fairshare';
import { CategoryIcon } from './CategoryIcon';
import { getInitials } from '../services/storage';
import { formatCurrency, round2, calculateBalances, calculateSettlements } from '../utils/settlement';

interface ExpenseListProps {
  expenses: Expense[];
  participants: Person[];
  currency: string;
  onOpenNewExpense: () => void;
  onOpenSmartSplit?: (expense?: Expense) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

const formatDateLabel = (dateStr: string): string => {
  if (!dateStr) return 'Fecha sin especificar';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

interface ExpenseCardItemProps {
  expense: Expense;
  participantMap: Map<string, Person>;
  participants: Person[];
  currency: string;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
  onOpenSmartSplit?: (expense: Expense) => void;
  showDate?: boolean;
}

const ExpenseCardItem: React.FC<ExpenseCardItemProps> = ({
  expense,
  participantMap,
  participants,
  currency,
  onEdit,
  onDelete,
  onOpenSmartSplit,
  showDate = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const payer = participantMap.get(expense.paidBy);
  const splitList = expense.splitAmong || [];
  const splitCount = splitList.length;
  const perPerson = splitCount > 0 ? round2(expense.amount / splitCount) : 0;

  const isMultiPayer = expense.payers && expense.payers.length > 1;
  const isItemized = expense.splitType === 'items' && expense.items && expense.items.length > 0;
  const isExact = expense.splitType === 'exact';

  // Audit calculations for this specific expense
  const singleExpenseBalances = useMemo(() => {
    return calculateBalances(participants, [expense]);
  }, [participants, expense]);

  const singleExpenseSettlements = useMemo(() => {
    return calculateSettlements(participants, [expense]);
  }, [participants, expense]);

  const activeBalances = useMemo(() => {
    return singleExpenseBalances.filter((b) => b.totalPaid > 0.009 || b.totalOwed > 0.009);
  }, [singleExpenseBalances]);

  const handleCopyExpenseSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const lines: string[] = [];
    lines.push(`*RESUMEN DE GASTO: ${expense.title.toUpperCase()}*`);
    lines.push(`Monto: *${formatCurrency(expense.amount, currency)}* | Fecha: ${expense.date}`);
    lines.push(``);
    lines.push(`*Diagnóstico (¿Qué pasó con el dinero?):*`);
    activeBalances.forEach((b) => {
      let veredicto = 'Al día ($0.00)';
      if (b.netBalance > 0.009) {
        veredicto = `Aportó +${formatCurrency(b.netBalance, currency)} (Recibe)`;
      } else if (b.netBalance < -0.009) {
        veredicto = `Le faltó -${formatCurrency(Math.abs(b.netBalance), currency)} (Debe)`;
      }
      lines.push(`- *${b.person.name}*: Le correspondió ${formatCurrency(b.totalOwed, currency)} | Aportó ${formatCurrency(b.totalPaid, currency)} -> *${veredicto}*`);
    });

    lines.push(``);
    lines.push(`*¿Quién le debe pagar a quién?:*`);
    if (singleExpenseSettlements.length === 0) {
      lines.push(`¡Cuentas equilibradas! No se requieren transferencias.`);
    } else {
      singleExpenseSettlements.forEach((s) => {
        lines.push(`👉 *${s.fromPerson?.name}* le transfiere *${formatCurrency(s.amount, currency)}* a *${s.toPerson?.name}*`);
      });
    }

    const text = lines.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div 
      className="expense-item animate-slide" 
      style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div className="expense-left">
          <CategoryIcon category={expense.category} size={18} showBackground />

          <div className="expense-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="expense-title">{expense.title}</span>

              {isMultiPayer && (
                <span className="vaca-badge" title="Pagado entre varios aportantes">
                  <Sparkles size={10} />
                  <span>Vaca ({expense.payers?.length} personas)</span>
                </span>
              )}

              {isItemized && (
                <span className="items-badge" title="Gasto con múltiples compras / ítems">
                  <ShoppingBag size={10} />
                  <span>{expense.items?.length} ítems</span>
                </span>
              )}

              {isExact && (
                <span className="items-badge" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                  <DollarSign size={10} />
                  <span>Montos exactos</span>
                </span>
              )}

              {/* Balance toggle button */}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  color: isExpanded ? 'var(--color-ink)' : 'var(--color-slate)',
                  background: isExpanded ? 'var(--color-silver-light)' : '#f8fafc',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-pills)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Ver balance y quién debe a quién en este gasto"
              >
                <Sparkles size={11} />
                <span>{isExpanded ? 'Ocultar balance' : 'Ver balance'}</span>
                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>

            <div className="expense-meta-row">
              {/* Payer information */}
              {isMultiPayer ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-slate)' }}>Aportaron:</span>
                  {expense.payers?.map((p) => {
                    const person = participantMap.get(p.personId);
                    if (!person) return null;
                    return (
                      <span key={p.personId} style={{ fontWeight: 500, fontSize: '11.5px', color: 'var(--color-graphite)' }}>
                        {person.name} ({formatCurrency(p.amount, currency)})
                      </span>
                    );
                  })}
                </div>
              ) : (
                payer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--color-slate)' }}>Pagó:</span>
                    <div
                      className="avatar-circle"
                      style={{
                        backgroundColor: payer.color,
                        color: '#ffffff',
                        width: 18,
                        height: 18,
                        fontSize: '9px',
                      }}
                    >
                      {getInitials(payer.name)}
                    </div>
                    <span className="expense-payer-tag">{payer.name}</span>
                  </div>
                )
              )}

              {showDate && (
                <>
                  <span style={{ color: 'var(--color-silver)' }}>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} color="var(--color-slate)" />
                    <span>{expense.date}</span>
                  </div>
                </>
              )}

              <span style={{ color: 'var(--color-silver)' }}>•</span>

              <span>
                {isItemized
                  ? `Repartido entre ${splitCount} persona${splitCount > 1 ? 's' : ''}`
                  : `Entre ${splitCount} persona${splitCount > 1 ? 's' : ''}`}
              </span>
            </div>

            {expense.notes && (
              <div style={{ fontSize: '12px', color: 'var(--color-slate)', marginTop: '2px', fontStyle: 'italic' }}>
                "{expense.notes}"
              </div>
            )}
          </div>
        </div>

        <div className="expense-right">
          <div className="expense-amount-box">
            <div className="expense-amount">{formatCurrency(expense.amount, currency)}</div>
            {!isItemized && !isExact && (
              <div className="expense-per-person">
                {formatCurrency(perPerson, currency)} c/u
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onEdit(expense)}
              title="Editar gasto"
              style={{ padding: '6px' }}
            >
              <Edit3 size={14} />
            </button>

            <button
              className="btn btn-danger-ghost btn-sm"
              onClick={() => onDelete(expense.id)}
              title="Eliminar gasto"
              style={{ padding: '6px' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Retroalimentación & Diagnostics View */}
      {isExpanded && (
        <div 
          className="expense-items-details animate-fade" 
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-silver)' }}
        >
          {/* 1. Itemized purchases list (if any) */}
          {isItemized && expense.items && expense.items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--color-slate)', textTransform: 'uppercase' }}>
                Desglose de compras / ticket ({expense.items.length}):
              </div>

              {expense.items.map((item) => {
                const assignedConsumers = item.assignedTo
                  .map((id) => participantMap.get(id))
                  .filter(Boolean) as Person[];

                const itemShare = assignedConsumers.length > 0 ? (Number(item.amount) || 0) / assignedConsumers.length : 0;

                // Item payers
                const hasItemPayers = item.payers && item.payers.length > 0;

                return (
                  <div key={item.id} className="item-detail-entry" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{item.name}</span>
                      <strong style={{ fontSize: '12px', color: 'var(--color-ink)' }}>{formatCurrency(item.amount, currency)}</strong>
                    </div>

                    {/* Payers for this item */}
                    {hasItemPayers && (
                      <div style={{ fontSize: '11px', color: 'var(--color-graphite)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--color-slate)' }}>Pagaron:</span>
                        {item.payers?.map((pr) => {
                          const pObj = participantMap.get(pr.personId);
                          return (
                            <span key={pr.personId} style={{ fontWeight: 500 }}>
                              {pObj?.name || 'Participante'} ({formatCurrency(pr.amount, currency)})
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Consumers for this item */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>Consumieron:</span>
                      <div className="item-detail-consumers">
                        {assignedConsumers.map((c) => (
                          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span
                              className="avatar-circle"
                              style={{ backgroundColor: c.color, width: 12, height: 12, fontSize: '7px', color: '#fff' }}
                            >
                              {getInitials(c.name)}
                            </span>
                            <span>{c.name}</span>
                          </span>
                        ))}
                        <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>({formatCurrency(itemShare, currency)} c/u)</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {expense.extraFee && expense.extraFee > 0 && (
                <div className="item-detail-entry" style={{ borderTop: '1px dashed var(--color-silver)', paddingTop: '4px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--color-slate)' }}>+ Propina / Costo extra:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(expense.extraFee, currency)}</span>
                </div>
              )}
            </div>
          )}

          {/* 2. Audit: ¿Qué pasó con el dinero? (Consumió vs Puso) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase' }}>
                Diagnóstico del gasto: ¿Qué pasó con el dinero?
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>
                Consumo real vs Lo que puso cada persona
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activeBalances.map((b) => (
                <div
                  key={b.person.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-inputs)',
                    background: 'var(--color-white)',
                    border: '1px solid var(--color-silver)',
                    fontSize: '11.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: b.person.color, width: 18, height: 18, fontSize: '8px', color: '#fff' }}
                    >
                      {getInitials(b.person.name)}
                    </div>
                    <span style={{ fontWeight: 600 }}>{b.person.name}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-slate)' }}>
                      <span>Le correspondió: {formatCurrency(b.totalOwed, currency)}</span>
                      <span style={{ margin: '0 4px' }}>|</span>
                      <span>Aportó: {formatCurrency(b.totalPaid, currency)}</span>
                    </div>

                    <span
                      className={`badge-balance ${
                        b.netBalance > 0.009 ? 'badge-positive' : b.netBalance < -0.009 ? 'badge-negative' : 'badge-neutral'
                      }`}
                      style={{ minWidth: '120px', justifyContent: 'center', fontSize: '10px', padding: '2px 6px' }}
                    >
                      {b.netBalance > 0.009
                        ? `Aportó +${formatCurrency(b.netBalance, currency)} (Recibe)`
                        : b.netBalance < -0.009
                        ? `Le faltó -${formatCurrency(Math.abs(b.netBalance), currency)} (Debe)`
                        : 'Al día ($0.00)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Quién le debe pagar a quién para saldar este gasto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase' }}>
              ¿Quién le debe pagar a quién para saldar este gasto?
            </span>

            {singleExpenseSettlements.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: 'var(--color-success)', fontWeight: 500, padding: '4px 0' }}>
                ✓ Este gasto está equilibrado o no requiere transferencias individuales adicionales.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {singleExpenseSettlements.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: '#f8fafc',
                      border: '1px solid var(--color-silver)',
                      borderRadius: 'var(--radius-inputs)',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        className="avatar-circle"
                        style={{ backgroundColor: tx.fromPerson?.color || 'var(--color-ink)', width: 16, height: 16, fontSize: '7px', color: '#fff' }}
                      >
                        {getInitials(tx.fromPerson?.name || '?')}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{tx.fromPerson?.name}</span>
                      <ArrowRight size={11} style={{ color: 'var(--color-slate)' }} />
                      <div
                        className="avatar-circle"
                        style={{ backgroundColor: tx.toPerson?.color || 'var(--color-ink)', width: 16, height: 16, fontSize: '7px', color: '#fff' }}
                      >
                        {getInitials(tx.toPerson?.name || '?')}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{tx.toPerson?.name}</span>
                    </div>

                    <strong style={{ fontSize: '12px', color: 'var(--color-ink)' }}>
                      {formatCurrency(tx.amount, currency)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--color-silver)' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCopyExpenseSummary}
              style={{ fontSize: '11px', padding: '3px 8px', gap: '4px' }}
              title="Copiar resumen de este gasto para WhatsApp"
            >
              {copied ? <Check size={12} /> : <Share2 size={12} />}
              <span>{copied ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
            </button>

            {onOpenSmartSplit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenSmartSplit(expense)}
                style={{ fontSize: '11px', padding: '3px 8px', gap: '4px' }}
                title="Abrir este gasto en el Asistente interactivo de Vaca"
              >
                <Sparkles size={12} />
                <span>Abrir en Asistente de Vaca</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  participants,
  currency,
  onOpenNewExpense,
  onOpenSmartSplit,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  const participantMap = new Map<string, Person>();
  participants.forEach((p) => participantMap.set(p.id, p));

  // Filter expenses
  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch = 
      exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (participantMap.get(exp.paidBy)?.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.payers && exp.payers.some((payer) => participantMap.get(payer.personId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (exp.items && exp.items.some((it) => it.name.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group expenses by date (sorted descending: newest first)
  const groupedByDate = filteredExpenses.reduce<Record<string, Expense[]>>((acc, expense) => {
    const d = expense.date || 'Sin fecha';
    if (!acc[d]) acc[d] = [];
    acc[d].push(expense);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="glass-panel animate-fade">
      <div className="panel-header expense-panel-header">
        <div className="expense-header-title-box">
          <h3 className="panel-title">
            <Receipt size={18} />
            <span>Gastos ({expenses.length})</span>
          </h3>

          {expenses.length > 0 && (
            <div className="view-mode-toggle-group">
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('timeline')}
                style={{ padding: '3px 8px', fontSize: '11px' }}
                title="Agrupar por días"
              >
                <CalendarDays size={12} />
                <span>Por Días</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('list')}
                style={{ padding: '3px 8px', fontSize: '11px' }}
                title="Ver lista corrida"
              >
                <List size={12} />
                <span>Lista</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenSmartSplit && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onOpenSmartSplit?.()}
              disabled={participants.length === 0}
              title={participants.length === 0 ? 'Agrega participantes primero' : 'Asistente para dividir cuentas grandes, vacas con aportes mixtos y compras múltiples'}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} />
              <span>Cuenta Grande / Vaca</span>
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={onOpenNewExpense}
            disabled={participants.length === 0}
            title={participants.length === 0 ? 'Agrega participantes primero' : 'Registrar nuevo gasto'}
          >
            <Plus size={15} />
            <span>Nuevo Gasto</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {expenses.length > 0 && (
        <div className="expense-filters-bar">
          <div className="expense-search-wrapper">
            <Search
              size={14}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-stone)' }}
            />
            <input
              type="text"
              placeholder="Buscar por gasto, ítem o pagador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '34px' }}
            />
          </div>

          <div className="expense-filter-select-wrapper">
            <Filter size={14} color="var(--color-slate)" style={{ flexShrink: 0 }} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ fontSize: '13px' }}
            >
              <option value="all">Todas las categorías</option>
              {(Object.keys(CATEGORIES) as ExpenseCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORIES[cat].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Expenses Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Layers size={22} />
            </div>
            <h4>No hay gastos registrados</h4>
            <p style={{ fontSize: '13px', maxWidth: '340px' }}>
              {participants.length === 0
                ? 'Primero añade participantes a la izquierda.'
                : 'Haz clic en "+ Nuevo Gasto" para registrar el primer gasto.'}
            </p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <p style={{ fontSize: '13px' }}>No se encontraron gastos coincidentes.</p>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline grouped by day view */
          sortedDates.map((dateKey) => {
            const dayExpenses = groupedByDate[dateKey];
            const dayTotal = round2(dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

            return (
              <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Date Group Header */}
                <div className="date-group-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <Calendar size={13} color="var(--color-slate)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-graphite)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatDateLabel(dateKey)}
                    </span>
                  </div>

                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-slate)', flexShrink: 0 }}>
                    Total: {formatCurrency(dayTotal, currency)} ({dayExpenses.length})
                  </span>
                </div>

                {/* Day Expense Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dayExpenses.map((expense) => (
                    <ExpenseCardItem
                      key={expense.id}
                      expense={expense}
                      participantMap={participantMap}
                      participants={participants}
                      currency={currency}
                      onEdit={onEditExpense}
                      onDelete={onDeleteExpense}
                      onOpenSmartSplit={onOpenSmartSplit}
                      showDate={false}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          /* Continuous flat list */
          filteredExpenses.map((expense) => (
            <ExpenseCardItem
              key={expense.id}
              expense={expense}
              participantMap={participantMap}
              participants={participants}
              currency={currency}
              onEdit={onEditExpense}
              onDelete={onDeleteExpense}
              onOpenSmartSplit={onOpenSmartSplit}
              showDate={true}
            />
          ))
        )}
      </div>
    </div>
  );
};
