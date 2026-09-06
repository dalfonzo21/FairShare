import React from 'react';
import { 
  Receipt, 
  Users, 
  Scale, 
  ArrowLeftRight,
  Check
} from 'lucide-react';
import type { FairShareGroup, SettlementTransaction } from '../types/fairshare';
import { formatCurrency, round2 } from '../utils/settlement';

interface StatsOverviewProps {
  group: FairShareGroup;
  settlements: SettlementTransaction[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ group, settlements }) => {
  const totalSpent = round2(
    group.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
  );

  const participantCount = group.participants.length;
  const avgPerPerson = participantCount > 0 ? round2(totalSpent / participantCount) : 0;
  const pendingSettlements = settlements.filter((s) => !s.isSettled).length;

  return (
    <div className="stats-grid animate-fade">
      <div className="stat-card">
        <div className="stat-icon-wrapper">
          <Receipt size={20} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Total Gastado</span>
          <span className="stat-value">{formatCurrency(totalSpent, group.currency)}</span>
          <span className="stat-sub">{group.expenses.length} gastos registrados</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper">
          <Users size={20} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Participantes</span>
          <span className="stat-value">{participantCount}</span>
          <span className="stat-sub">
            {participantCount === 0 ? 'Sin personas aún' : 'Integrantes del grupo'}
          </span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper">
          <Scale size={20} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Promedio / Persona</span>
          <span className="stat-value">{formatCurrency(avgPerPerson, group.currency)}</span>
          <span className="stat-sub">División equitativa</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper">
          <ArrowLeftRight size={20} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Por Liquidar</span>
          <span className="stat-value">
            {pendingSettlements === 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
                0 <Check size={16} />
              </span>
            ) : (
              `${pendingSettlements} pago${pendingSettlements > 1 ? 's' : ''}`
            )}
          </span>
          <span className="stat-sub">
            {pendingSettlements === 0 ? 'Cuentas saldadas' : 'Transferencias mínimas'}
          </span>
        </div>
      </div>
    </div>
  );
};
