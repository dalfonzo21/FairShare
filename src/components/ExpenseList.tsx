import React, { useState } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Filter, 
  Calendar, 
  Layers 
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

  return (
    <div className="glass-panel animate-fade">
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="panel-title">
          <Receipt size={18} />
          <span>Gastos Registrados ({expenses.length})</span>
        </h3>

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
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--color-slate)" />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Layers size={22} />
            </div>
            <h4>No hay gastos registrados</h4>
            <p style={{ fontSize: '13px', maxWidth: '340px' }}>
              {participants.length === 0
                ? 'Primero añade participantes a la izquierda.'
                : 'Haz clic en "+ Nuevo Gasto" para agregar el primer comprobante.'}
            </p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <p style={{ fontSize: '13px' }}>No se encontraron gastos coincidentes.</p>
          </div>
        ) : (
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
