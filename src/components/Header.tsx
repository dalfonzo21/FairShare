import React from 'react';
import { 
  RotateCcw, 
  Share2, 
  Layers, 
  Check,
  Edit2
} from 'lucide-react';
import type { FairShareGroup } from '../types/fairshare';

interface HeaderProps {
  group: FairShareGroup;
  onUpdateTitle: (title: string) => void;
  onUpdateCurrency: (currency: string) => void;
  onReset: () => void;
  onShare: () => void;
  copied: boolean;
}

const CURRENCIES = [
  { symbol: '$', label: '$ (Dólares / Pesos)' },
  { symbol: 'USD $', label: 'USD ($)' },
  { symbol: 'COP $', label: 'COP ($)' },
  { symbol: 'EUR €', label: 'EUR (€)' },
  { symbol: 'MXN $', label: 'MXN ($)' },
  { symbol: 'ARS $', label: 'ARS ($)' },
  { symbol: 'CLP $', label: 'CLP ($)' },
  { symbol: 'PEN S/', label: 'PEN (S/)' },
];

export const Header: React.FC<HeaderProps> = ({
  group,
  onUpdateTitle,
  onUpdateCurrency,
  onReset,
  onShare,
  copied,
}) => {
  return (
    <header className="header-wrapper">
      <div className="header-content">
        <div className="brand-section">
          <div className="brand-icon">
            <Layers size={18} strokeWidth={2.2} />
          </div>
          <div className="brand-title-box">
            <h1 className="brand-title">FairShare</h1>
            <span className="brand-tagline">División de Gastos</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onReset}
            title="Empezar desde cero"
          >
            <RotateCcw size={14} />
            <span>Limpiar</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={onShare}
            title="Copiar resumen para WhatsApp"
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? 'Copiado' : 'Compartir'}</span>
          </button>
        </div>
      </div>

      <div className="main-container" style={{ paddingBottom: '0', paddingTop: '16px' }}>
        <div className="event-title-card animate-fade">
          <div className="event-title-input-group">
            <Edit2 size={15} color="var(--color-slate)" />
            <input
              type="text"
              className="event-title-input"
              value={group.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              placeholder="Nombre del evento o viaje (ej: Asado con amigos)"
            />
          </div>

          <div className="currency-select-wrapper">
            <span>Moneda:</span>
            <select
              value={group.currency}
              onChange={(e) => onUpdateCurrency(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
