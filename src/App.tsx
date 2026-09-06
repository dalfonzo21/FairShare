import { useState, useEffect, useMemo, useRef } from 'react';
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
  Person,
  GroupSummary 
} from './types/fairshare';
import { 
  getStoredGroup, 
  saveStoredGroup, 
  createEmptyGroup, 
  getStoredGroupsIndex,
  getStoredGroupById,
  generateId 
} from './services/storage';
import { 
  isFirebaseConfigured, 
  saveGroupToCloud, 
  subscribeToCloudGroup 
} from './services/firebase';
import { 
  calculateBalances, 
  calculateSettlements, 
  generateWhatsAppSummary 
} from './utils/settlement';
import './App.css';

export function App() {
  // Read group ID from URL query parameters (e.g. ?group=viaje-amigos-123)
  const getInitialGroupId = (): string | undefined => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group') || undefined;
  };

  const [group, setGroup] = useState<FairShareGroup>(() => getStoredGroup(getInitialGroupId()));
  const [groupsIndex, setGroupsIndex] = useState<GroupSummary[]>(() => getStoredGroupsIndex());
  const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'settlement' | 'participants'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isRemoteUpdate = useRef(false);
  const isCloud = isFirebaseConfigured();

  // Keep URL in sync with active group ID
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('group') !== group.id) {
      url.searchParams.set('group', group.id);
      window.history.replaceState({}, '', url.toString());
    }
  }, [group.id]);

  // Real-time Firestore Subscription
  useEffect(() => {
    if (!isCloud) return;

    const unsubscribe = subscribeToCloudGroup(group.id, (cloudGroup) => {
      isRemoteUpdate.current = true;
      setGroup(cloudGroup);
      saveStoredGroup(cloudGroup);
      setGroupsIndex(getStoredGroupsIndex());
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [group.id, isCloud]);

  // Auto-save to LocalStorage and sync to Firebase on change
  useEffect(() => {
    saveStoredGroup(group);
    setGroupsIndex(getStoredGroupsIndex());

    if (isCloud && !isRemoteUpdate.current) {
      saveGroupToCloud(group);
    }
    isRemoteUpdate.current = false;
  }, [group, isCloud]);

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

  // Group Switcher Actions
  const handleSelectGroup = (groupId: string) => {
    const selected = getStoredGroupById(groupId) || getStoredGroup(groupId);
    setGroup(selected);
    showToast(`Cargando: ${selected.title || 'Evento'}`);
  };

  const handleCreateNewGroup = () => {
    const newGroup = createEmptyGroup('Nuevo Evento / Viaje');
    setGroup(newGroup);
    showToast('Nuevo evento creado.');
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
      setGroup((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) =>
          e.id === editId ? { ...expenseData, id: editId } : e
        ),
      }));
      showToast('Gasto actualizado con éxito.');
    } else {
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
    if (window.confirm('¿Seguro que deseas reiniciar los datos de este evento?')) {
      const empty = createEmptyGroup(group.title || 'Mi Evento / Viaje');
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
      console.error('Error al copiar texto:', err);
      showToast('No se pudo copiar automáticamente.');
    }
  };

  // Copy Direct Link to Group
  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?group=${group.id}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedLink(true);
      showToast('Enlace directo del evento copiado al portapapeles.');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      showToast('No se pudo copiar el enlace.');
    }
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header
        group={group}
        groupsIndex={groupsIndex}
        onSelectGroup={handleSelectGroup}
        onCreateNewGroup={handleCreateNewGroup}
        onUpdateTitle={handleUpdateTitle}
        onUpdateCurrency={handleUpdateCurrency}
        onReset={handleReset}
        onShare={handleShare}
        onCopyLink={handleCopyLink}
        copied={copied}
        copiedLink={copiedLink}
        isCloud={isCloud}
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

            {/* Smart Settlement Resolution */}
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
