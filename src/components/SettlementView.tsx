import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Check, 
  Share2, 
  Sparkles, 
  TrendingUp,
  Coins,
  CreditCard
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { 
  PersonBalance, 
  SettlementTransaction, 
  FairShareGroup,
  PaymentMethod,
  CashSettlementSummary
} from '../types/fairshare';
import { getInitials } from '../services/storage';
import { 
  formatCurrency, 
  calculateFairCashSettlements
} from '../utils/settlement';

interface SettlementViewProps {
  group: FairShareGroup;
  balances: PersonBalance[];
  settlements: SettlementTransaction[];
  onToggleSettlement: (transactionId: string) => void;
  onShareWhatsApp: (cashSummary?: CashSettlementSummary | null) => void;
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
  // Modalidad: Transferencia digital exacta vs Efectivo físico con aproximado justo
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const cashSummary = useMemo(() => {
    return calculateFairCashSettlements(settlements);
  }, [settlements]);

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
    <div className="settlement-view-container">
      {/* Smart Settlement Transfers Card */}
      <div className="glass-panel animate-fade">
        <div className="panel-header settlement-header" style={{ alignItems: 'flex-start' }}>
          <div className="settlement-header-text">
            <h3 className="panel-title">
              <Sparkles size={18} />
              <span>Liquidación Óptima</span>
            </h3>
            <p className="panel-subtitle">
              Transferencias mínimas calculadas para saldar todas las cuentas.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onShareWhatsApp(cashSummary)}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? 'Copiado' : 'Copiar Resumen'}</span>
          </button>
        </div>

        {/* Modalidad Selector: Transferencia Digital vs Efectivo en Monedas */}
        {settlements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '8px', 
                background: 'var(--color-silver-light)', 
                padding: '4px', 
                borderRadius: 'var(--radius-inputs)' 
              }}
            >
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                  background: paymentMethod === 'transfer' ? '#ffffff' : 'transparent',
                  color: paymentMethod === 'transfer' ? 'var(--color-ink)' : 'var(--color-slate)',
                  boxShadow: paymentMethod === 'transfer' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <CreditCard size={15} />
                <span>Transferencia (Exacto)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                  background: paymentMethod === 'cash' ? '#ffffff' : 'transparent',
                  color: paymentMethod === 'cash' ? 'var(--color-ink)' : 'var(--color-slate)',
                  boxShadow: paymentMethod === 'cash' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Coins size={15} />
                <span>Efectivo (Aproximado Justo)</span>
              </button>
            </div>

            {/* Banner explicativo de Aproximado Justo en Efectivo */}
            {paymentMethod === 'cash' && (
              <div
                className="animate-fade"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                  fontSize: '11.5px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-graphite)' }}>
                  <Coins size={14} style={{ color: 'var(--color-ink)', flexShrink: 0 }} />
                  <span>
                    <strong>Aproximado justo en efectivo:</strong> Calculado con monedas reales para evitar dar centavos no comunes (como 2 o 3¢).
                  </span>
                </div>

                {Math.abs(cashSummary.totalSurplus) > 0.009 ? (
                  <span style={{ fontSize: '11px', color: cashSummary.totalSurplus > 0 ? 'var(--color-success)' : '#b45309', fontWeight: 600 }}>
                    {cashSummary.totalSurplus > 0
                      ? `+${formatCurrency(cashSummary.totalSurplus, group.currency)} diferencia (propina / cambio)`
                      : `-${formatCurrency(Math.abs(cashSummary.totalSurplus), group.currency)} ajuste`}
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>Exacto en monedas</span>
                )}
              </div>
            )}
          </div>
        )}

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
            {settlements.map((tx) => {
              const cashDetail = cashSummary.details.find((d) => d.transactionId === tx.id);
              const displayAmount = paymentMethod === 'cash' && cashDetail ? cashDetail.cashAmount : tx.amount;
              const hasDiff = paymentMethod === 'cash' && cashDetail && Math.abs(cashDetail.difference) > 0.009;

              return (
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
                      <div style={{ minWidth: 0 }}>
                        <div className="settlement-name">
                          {tx.fromPerson.name}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
                          Paga
                        </span>
                      </div>
                    </div>

                    {/* Arrow & Amount */}
                    <div className="settlement-arrow-box" style={{ minWidth: '150px' }}>
                      <div className="settlement-amount-pill" style={{ fontWeight: 700 }}>
                        {formatCurrency(displayAmount, group.currency)}
                      </div>

                      {/* Excedent / Transfer explanation label */}
                      <div style={{ fontSize: '10px', color: 'var(--color-slate)', marginTop: '2px', textAlign: 'center' }}>
                        {paymentMethod === 'transfer' ? (
                          'Transferencia exacta'
                        ) : hasDiff && cashDetail ? (
                          cashDetail.difference > 0 ? (
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                              Exacto: {formatCurrency(cashDetail.exactAmount, group.currency)} (+{formatCurrency(cashDetail.difference, group.currency)} excedente)
                            </span>
                          ) : (
                            <span style={{ color: '#b45309', fontWeight: 600 }}>
                              Exacto: {formatCurrency(cashDetail.exactAmount, group.currency)} (-{formatCurrency(Math.abs(cashDetail.difference), group.currency)} ajuste)
                            </span>
                          )
                        ) : (
                          'Exacto en monedas'
                        )}
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
                      <div style={{ minWidth: 0 }}>
                        <div className="settlement-name">
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
              );
            })}
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
                <div className="balance-user-info">
                  <div
                    className="avatar-circle"
                    style={{ backgroundColor: b.person.color, color: '#ffffff', width: 28, height: 28, fontSize: '11px' }}
                  >
                    {getInitials(b.person.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="balance-user-name">
                      {b.person.name}
                    </div>
                    <div className="balance-user-sub">
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

                <div className="balance-amount-info">
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
