import React, { useState } from 'react';
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
  List
} from 'lucide-react';
import type { Expense, ExpenseCategory, Person } from '../types/fairshare';
import { CATEGORIES } from '../types/fairshare';
import { CategoryIcon } from './CategoryIcon';
import { getInitials } from '../services/storage';
import { formatCurrency, round2 } from '../utils/settlement';

interface ExpenseListProps {
  expenses: Expense[];
  participants: Person[];
  currency: string;
  onOpenNewExpense: () => void;
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

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  participants,
  currency,
  onOpenNewExpense,
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
      (participantMap.get(exp.paidBy)?.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
              placeholder="Buscar gasto o pagador..."
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
                  {dayExpenses.map((expense) => {
                    const payer = participantMap.get(expense.paidBy);
                    const splitList = expense.splitAmong || [];
                    const splitCount = splitList.length;
                    const perPerson = splitCount > 0 ? round2(expense.amount / splitCount) : 0;

                    return (
                      <div key={expense.id} className="expense-item animate-slide">
                        <div className="expense-left">
                          <CategoryIcon category={expense.category} size={18} showBackground />

                          <div className="expense-details">
                            <div className="expense-title">{expense.title}</div>
                            
                            <div className="expense-meta-row">
                              {payer && (
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
                              )}

                              <span style={{ color: 'var(--color-silver)' }}>•</span>

                              <span>
                                Entre {splitCount} persona{splitCount > 1 ? 's' : ''}
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
                            <div className="expense-per-person">
                              {formatCurrency(perPerson, currency)} c/u
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => onEditExpense(expense)}
                              title="Editar gasto"
                              style={{ padding: '6px' }}
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => onDeleteExpense(expense.id)}
                              title="Eliminar gasto"
                              style={{ padding: '6px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          /* Continuous flat list */
          filteredExpenses.map((expense) => {
            const payer = participantMap.get(expense.paidBy);
            const splitList = expense.splitAmong || [];
            const splitCount = splitList.length;
            const perPerson = splitCount > 0 ? round2(expense.amount / splitCount) : 0;

            return (
              <div key={expense.id} className="expense-item animate-slide">
                <div className="expense-left">
                  <CategoryIcon category={expense.category} size={18} showBackground />

                  <div className="expense-details">
                    <div className="expense-title">{expense.title}</div>
                    
                    <div className="expense-meta-row">
                      {payer && (
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
                      )}

                      <span style={{ color: 'var(--color-silver)' }}>•</span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} color="var(--color-slate)" />
                        <span>{expense.date}</span>
                      </div>

                      <span style={{ color: 'var(--color-silver)' }}>•</span>

                      <span>
                        Entre {splitCount} persona{splitCount > 1 ? 's' : ''}
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
                    <div className="expense-per-person">
                      {formatCurrency(perPerson, currency)} c/u
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onEditExpense(expense)}
                      title="Editar gasto"
                      style={{ padding: '6px' }}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      className="btn btn-danger-ghost btn-sm"
                      onClick={() => onDeleteExpense(expense.id)}
                      title="Eliminar gasto"
                      style={{ padding: '6px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
