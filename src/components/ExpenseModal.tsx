import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, Calendar, Users, FileText } from 'lucide-react';
import type { Expense, ExpenseCategory, Person } from '../types/fairshare';
import { CATEGORIES } from '../types/fairshare';
import { CategoryIcon } from './CategoryIcon';
import { getInitials } from '../services/storage';
import { formatCurrency, round2 } from '../utils/settlement';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>, editId?: string) => void;
  participants: Person[];
  currency: string;
  expenseToEdit?: Expense | null;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  currency,
  expenseToEdit,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [paidBy, setPaidBy] = useState('');
  const [splitAmong, setSplitAmong] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (expenseToEdit) {
        setTitle(expenseToEdit.title);
        setAmount(expenseToEdit.amount.toString());
        setCategory(expenseToEdit.category);
        setPaidBy(expenseToEdit.paidBy);
        setSplitAmong(expenseToEdit.splitAmong || participants.map((p) => p.id));
        setDate(expenseToEdit.date || new Date().toISOString().split('T')[0]);
        setNotes(expenseToEdit.notes || '');
      } else {
        setTitle('');
        setAmount('');
        setCategory('food');
        setPaidBy(participants[0]?.id || '');
        setSplitAmong(participants.map((p) => p.id));
        setDate(new Date().toISOString().split('T')[0]);
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, expenseToEdit, participants]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const splitCount = splitAmong.length;
  const perPersonShare = splitCount > 0 ? round2(numAmount / splitCount) : 0;

  const toggleParticipant = (pId: string) => {
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

  const selectAll = () => {
    setSplitAmong(participants.map((p) => p.id));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Por favor ingresa una descripción o concepto.');
      return;
    }
    if (numAmount <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }
    if (!paidBy) {
      setError('Selecciona quién pagó este gasto.');
      return;
    }
    if (splitAmong.length === 0) {
      setError('Debes seleccionar al menos una persona que comparta el gasto.');
      return;
    }

    onSave(
      {
        title: title.trim(),
        amount: numAmount,
        category,
        paidBy,
        splitAmong,
        date,
        notes: notes.trim(),
      },
      expenseToEdit?.id
    );

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {expenseToEdit ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
          </h3>
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
                }}
              >
                {error}
              </div>
            )}

            {/* Concept / Title */}
            <div className="form-group">
              <label className="form-label">Concepto o Descripción *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cena en restaurante, Gasolina, Supermercado..."
                autoFocus
              />
            </div>

            {/* Amount and Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">
                  <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Monto * ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
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
                      <CategoryIcon category={catKey} size={16} />
                      <span>{cat.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paid By Selection */}
            <div className="form-group">
              <label className="form-label">¿Quién pagó la cuenta? *</label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                style={{ width: '100%' }}
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Split Among Selection */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">
                  <Users size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> ¿Entre quiénes se divide?
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={selectAll}
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                >
                  Seleccionar todos
                </button>
              </div>

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
                {participants.map((p) => {
                  const isIncluded = splitAmong.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleParticipant(p.id)}
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
                        boxShadow: isIncluded ? 'var(--shadow-card)' : 'none',
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
                        <div className="avatar-circle" style={{ backgroundColor: p.color, color: '#ffffff', width: 22, height: 22, fontSize: '10px' }}>
                          {getInitials(p.name)}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-graphite)' }}>{p.name}</span>
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

              {numAmount > 0 && splitCount > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-slate)', textAlign: 'right', marginTop: '2px' }}>
                  {splitCount} persona{splitCount > 1 ? 's' : ''} pagan {formatCurrency(perPersonShare, currency)} cada una
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
                placeholder="Detalles adicionales..."
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
    </div>
  );
};
