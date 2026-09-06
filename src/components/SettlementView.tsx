import React from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Check, 
  Share2, 
  Sparkles, 
  TrendingUp 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { PersonBalance, SettlementTransaction, FairShareGroup } from '../types/fairshare';
import { getInitials } from '../services/storage';
import { formatCurrency } from '../utils/settlement';

interface SettlementViewProps {
  group: FairShareGroup;
  balances: PersonBalance[];
  settlements: SettlementTransaction[];
  onToggleSettlement: (transactionId: string) => void;
  onShareWhatsApp: () => void;
  copied: boolean;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  group,
  balances,
  settlements,
  onToggleSettlement,
  onShareWhatsApp,
  copied,
}) => {
  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#101010', '#6b7280', '#0099ff', '#15803d'],
    });
  };

  const handleToggle = (id: string, currentlySettled?: boolean) => {
    if (!currentlySettled) {
      triggerConfetti();
    }
    onToggleSettlement(id);
  };

  const pendingSettlements = settlements.filter((s) => !s.isSettled);
  const maxAbsBalance = Math.max(...balances.map((b) => Math.abs(b.netBalance)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Smart Settlement Transfers Card */}
      <div className="glass-panel animate-fade">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="panel-title">
              <Sparkles size={18} />
              <span>Liquidación Óptima</span>
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-slate)', marginTop: '2px' }}>
              Transferencias mínimas calculadas para saldar todas las cuentas.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onShareWhatsApp}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? 'Copiado' : 'Copiar Resumen'}</span>
          </button>
        </div>

        {settlements.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--color-silver-light)', borderRadius: 'var(--radius-cards)' }}>
            <div className="empty-icon" style={{ background: 'var(--color-white)' }}>
              <CheckCircle2 size={24} color="var(--color-slate)" />
            </div>
            <h4>Cuentas al Día</h4>
            <p style={{ fontSize: '13px' }}>
              {group.expenses.length === 0
                ? 'Agrega gastos para calcular automáticamente las transferencias.'
                : 'No existen saldos pendientes por pagar.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {settlements.map((tx) => (
              <div
                key={tx.id}
                className={`settlement-card animate-slide ${tx.isSettled ? 'settled' : ''}`}
              >
                <div className="settlement-flow">
                  {/* Debtor (Who pays) */}
                  <div className="settlement-person">
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: tx.fromPerson.color, color: '#ffffff' }}
                    >
                      {getInitials(tx.fromPerson.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-graphite)' }}>
                        {tx.fromPerson.name}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
                        Paga
                      </span>
                    </div>
                  </div>

                  {/* Arrow & Amount */}
                  <div className="settlement-arrow-box">
                    <div className="settlement-amount-pill">
                      {formatCurrency(tx.amount, group.currency)}
                    </div>
                    <div className="settlement-arrow-line">
                      <ArrowRight size={16} />
                    </div>
                  </div>

                  {/* Creditor (Who receives) */}
                  <div className="settlement-person">
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: tx.toPerson.color, color: '#ffffff' }}
                    >
                      {getInitials(tx.toPerson.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-graphite)' }}>
                        {tx.toPerson.name}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>
                        Recibe
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settle Action Button */}
                <button
                  className={`btn btn-sm ${tx.isSettled ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => handleToggle(tx.id, tx.isSettled)}
                  style={{ minWidth: '120px' }}
                >
                  {tx.isSettled ? (
                    <>
                      <Check size={13} />
                      <span>Liquidado</span>
                    </>
                  ) : (
                    <span>Marcar Pagado</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingSettlements.length === 0 && settlements.length > 0 && (
          <div className="info-banner animate-fade">
            <CheckCircle2 size={16} />
            <span>Todas las transferencias de este grupo han sido marcadas como liquidadas.</span>
          </div>
        )}
      </div>

      {/* Individual Balances Breakdown Table */}
      <div className="glass-panel animate-fade">
        <div className="panel-header">
          <h3 className="panel-title">
            <TrendingUp size={18} />
            <span>Balances Individuales</span>
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {balances.map((b) => {
            const isCreditor = b.netBalance > 0.009;
            const isDebtor = b.netBalance < -0.009;
            const barWidth = Math.min(100, Math.round((Math.abs(b.netBalance) / maxAbsBalance) * 100));

            return (
              <div key={b.person.id} className="balance-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '180px' }}>
                  <div
                    className="avatar-circle"
                    style={{ backgroundColor: b.person.color, color: '#ffffff', width: 28, height: 28, fontSize: '11px' }}
                  >
                    {getInitials(b.person.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-graphite)' }}>
                      {b.person.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                      Pagó {formatCurrency(b.totalPaid, group.currency)}
                    </div>
                  </div>
                </div>

                {/* Progress bar scale */}
                <div className="balance-progress-container">
                  <div
                    className="balance-progress-bar"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: isCreditor ? 'var(--color-success)' : isDebtor ? 'var(--color-danger)' : 'var(--color-slate)',
                    }}
                  />
                </div>

                <div style={{ textAlign: 'right', minWidth: '130px' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      color: isCreditor ? 'var(--color-success)' : isDebtor ? 'var(--color-danger)' : 'var(--color-slate)',
                    }}
                  >
                    {isCreditor
                      ? `+${formatCurrency(b.netBalance, group.currency)}`
                      : formatCurrency(b.netBalance, group.currency)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                    {isCreditor ? 'Le deben' : isDebtor ? 'Debe pagar' : 'Al día'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
