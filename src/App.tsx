import { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Users, 
  ArrowLeftRight, 
  Check,
  Layers
} from 'lucide-react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { ParticipantList } from './components/ParticipantList';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseModal } from './components/ExpenseModal';
import { SettlementView } from './components/SettlementView';
import type { 
  FairShareGroup, 
  Expense, 
  Person 
} from './types/fairshare';
import { 
  getStoredGroup, 
  saveStoredGroup, 
  createEmptyGroup, 
  generateId 
} from './services/storage';
import { 
  calculateBalances, 
  calculateSettlements, 
  generateWhatsAppSummary 
} from './utils/settlement';
import './App.css';

export function App() {
  const [group, setGroup] = useState<FairShareGroup>(() => getStoredGroup());
  const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'settlement' | 'participants'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-save to LocalStorage whenever group changes
  useEffect(() => {
    saveStoredGroup(group);
  }, [group]);

  // Derived financial balances and settlements
  const balances = useMemo(() => {
    return calculateBalances(group.participants, group.expenses);
  }, [group.participants, group.expenses]);

  const settlements = useMemo(() => {
    return calculateSettlements(
      group.participants,
      group.expenses,
      group.settledTransactions || []
    );
  }, [group.participants, group.expenses, group.settledTransactions]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Participant Actions
  const handleAddParticipant = (name: string, color: string) => {
    const newPerson: Person = {
      id: generateId(),
      name,
      color,
    };

    setGroup((prev) => ({
      ...prev,
      participants: [...prev.participants, newPerson],
    }));

    showToast(`Se agregó a ${name} al grupo.`);
  };

  const handleRemoveParticipant = (id: string) => {
    const person = group.participants.find((p) => p.id === id);
    if (!person) return;

    const hasExpenses = group.expenses.some(
      (e) => e.paidBy === id || (e.splitAmong && e.splitAmong.includes(id))
    );

    if (hasExpenses) {
      const confirmDelete = window.confirm(
        `${person.name} tiene gastos o consumos asociados. Si lo eliminas, se ajustarán los gastos. ¿Deseas continuar?`
      );
      if (!confirmDelete) return;
    }

    setGroup((prev) => {
      // Remove person from participants and from splitAmong lists
      const updatedExpenses = prev.expenses
        .filter((e) => e.paidBy !== id)
        .map((e) => ({
          ...e,
          splitAmong: e.splitAmong.filter((pId) => pId !== id),
        }));

      return {
        ...prev,
        participants: prev.participants.filter((p) => p.id !== id),
        expenses: updatedExpenses,
      };
    });

    showToast(`Se eliminó a ${person.name}.`);
  };

  // Expense Actions
  const handleOpenNewExpense = () => {
    if (group.participants.length === 0) {
      showToast('Agrega al menos un participante primero.');
      return;
    }
    setExpenseToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const handleSaveExpense = (expenseData: Omit<Expense, 'id'>, editId?: string) => {
    if (editId) {
      // Editing existing expense
      setGroup((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) =>
          e.id === editId ? { ...expenseData, id: editId } : e
        ),
      }));
      showToast('Gasto actualizado con éxito.');
    } else {
      // New expense
      const newExpense: Expense = {
        ...expenseData,
        id: generateId(),
      };
      setGroup((prev) => ({
        ...prev,
        expenses: [newExpense, ...prev.expenses],
      }));
      showToast('Gasto registrado con éxito.');
    }
  };

  const handleDeleteExpense = (id: string) => {
    setGroup((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    showToast('Gasto eliminado.');
  };

  // Settlement Actions
  const handleToggleSettlement = (transactionId: string) => {
    setGroup((prev) => {
      const currentSettled = prev.settledTransactions || [];
      const isAlreadySettled = currentSettled.includes(transactionId);
      const newSettled = isAlreadySettled
        ? currentSettled.filter((id) => id !== transactionId)
        : [...currentSettled, transactionId];

      return {
        ...prev,
        settledTransactions: newSettled,
      };
    });
  };

  // Group Info Actions
  const handleUpdateTitle = (title: string) => {
    setGroup((prev) => ({ ...prev, title }));
  };

  const handleUpdateCurrency = (currency: string) => {
    setGroup((prev) => ({ ...prev, currency }));
  };

  const handleReset = () => {
    if (window.confirm('¿Seguro que deseas reiniciar y borrar todos los datos del evento actual?')) {
      const empty = createEmptyGroup();
      setGroup(empty);
      showToast('Evento reiniciado.');
    }
  };

  // WhatsApp / Clipboard Export
  const handleShare = async () => {
    const text = generateWhatsAppSummary(group, balances, settlements);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        showToast('Resumen copiado al portapapeles.');
        setTimeout(() => setCopied(false), 3000);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        showToast('Resumen copiado al portapapeles.');
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('Error copying text:', err);
      showToast('No se pudo copiar automáticamente.');
    }
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header
        group={group}
        onUpdateTitle={handleUpdateTitle}
        onUpdateCurrency={handleUpdateCurrency}
        onReset={handleReset}
        onShare={handleShare}
        copied={copied}
      />

      {/* Main Content Area */}
      <main className="main-container">
        {/* Key Metrics Overview */}
        <StatsOverview group={group} settlements={settlements} />

        {/* Navigation Tabs */}
        <div className="tabs-navigation">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Layers size={14} />
            <span>Vista Completa</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'settlement' ? 'active' : ''}`}
            onClick={() => setActiveTab('settlement')}
          >
            <ArrowLeftRight size={14} />
            <span>Liquidaciones & Deudas</span>
            {settlements.filter((s) => !s.isSettled).length > 0 && (
              <span className="tab-badge">
                {settlements.filter((s) => !s.isSettled).length}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveTab('expenses')}
          >
            <Receipt size={14} />
            <span>Gastos ({group.expenses.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            <Users size={14} />
            <span>Participantes ({group.participants.length})</span>
          </button>
        </div>

        {/* Dynamic Tab Views */}
        {activeTab === 'all' && (
          <div className="content-grid">
            {/* Quick Dual Columns: Participants + Expenses */}
            <div className="dual-column-layout">
              <ParticipantList
                participants={group.participants}
                balances={balances}
                currency={group.currency}
                onAddParticipant={handleAddParticipant}
                onRemoveParticipant={handleRemoveParticipant}
              />

              <ExpenseList
                expenses={group.expenses}
                participants={group.participants}
                currency={group.currency}
                onOpenNewExpense={handleOpenNewExpense}
                onEditExpense={handleEditExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            </div>

            {/* Smart Settlement Resolution on full view */}
            <SettlementView
              group={group}
              balances={balances}
              settlements={settlements}
              onToggleSettlement={handleToggleSettlement}
              onShareWhatsApp={handleShare}
              copied={copied}
            />
          </div>
        )}

        {activeTab === 'settlement' && (
          <SettlementView
            group={group}
            balances={balances}
            settlements={settlements}
            onToggleSettlement={handleToggleSettlement}
            onShareWhatsApp={handleShare}
            copied={copied}
          />
        )}

        {activeTab === 'expenses' && (
          <div className="dual-column-layout">
            <ParticipantList
              participants={group.participants}
              balances={balances}
              currency={group.currency}
              onAddParticipant={handleAddParticipant}
              onRemoveParticipant={handleRemoveParticipant}
            />

            <ExpenseList
              expenses={group.expenses}
              participants={group.participants}
              currency={group.currency}
              onOpenNewExpense={handleOpenNewExpense}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          </div>
        )}

        {activeTab === 'participants' && (
          <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
            <ParticipantList
              participants={group.participants}
              balances={balances}
              currency={group.currency}
              onAddParticipant={handleAddParticipant}
              onRemoveParticipant={handleRemoveParticipant}
            />
          </div>
        )}
      </main>

      {/* Expense Modal (Add / Edit) */}
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        participants={group.participants}
        currency={group.currency}
        expenseToEdit={expenseToEdit}
      />

      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast-message">
            <Check size={14} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--color-silver)',
          padding: '20px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--color-slate)',
        }}
      >
        <span>FairShare • División Inteligente de Gastos</span>
      </footer>
    </div>
  );
}

export default App;
