import React, { useState } from 'react';
import { 
  RotateCcw, 
  Share2, 
  Layers, 
  Check, 
  Edit2, 
  Plus, 
  FolderOpen, 
  Cloud, 
  HardDrive,
  Link2
} from 'lucide-react';
import type { FairShareGroup, GroupSummary } from '../types/fairshare';

interface HeaderProps {
  group: FairShareGroup;
  groupsIndex: GroupSummary[];
  onSelectGroup: (groupId: string) => void;
  onCreateNewGroup: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateCurrency: (currency: string) => void;
  onReset: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  copied: boolean;
  copiedLink: boolean;
  isCloud: boolean;
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
  groupsIndex,
  onSelectGroup,
  onCreateNewGroup,
  onUpdateTitle,
  onUpdateCurrency,
  onReset,
  onShare,
  onCopyLink,
  copied,
  copiedLink,
  isCloud,
}) => {
  const [showEventDropdown, setShowEventDropdown] = useState(false);

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

          {/* Cloud vs Local Indicator */}
          <div 
            title={isCloud ? 'Sincronizado con Firebase Firestore' : 'Guardado en LocalStorage (Modo local)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pills)',
              background: isCloud ? 'var(--color-success-bg)' : 'var(--color-silver-light)',
              color: isCloud ? 'var(--color-success)' : 'var(--color-slate)',
              border: `1px solid ${isCloud ? 'var(--color-success-border)' : 'var(--color-silver)'}`,
              marginLeft: '6px',
            }}
          >
            {isCloud ? <Cloud size={12} /> : <HardDrive size={12} />}
            <span>{isCloud ? 'Nube' : 'Local'}</span>
          </div>
        </div>

        <div className="header-actions">
          {/* Multiple Trips / Events Selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowEventDropdown(!showEventDropdown)}
              title="Ver otros eventos o viajes guardados"
            >
              <FolderOpen size={14} />
              <span>Mis Eventos ({groupsIndex.length})</span>
            </button>

            {showEventDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '260px',
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-silver)',
                  borderRadius: 'var(--radius-cards)',
                  boxShadow: 'var(--shadow-modal)',
                  padding: '8px',
                  zIndex: 60,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px 8px', borderBottom: '1px solid var(--color-silver)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-slate)', textTransform: 'uppercase' }}>
                    Eventos Guardados
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setShowEventDropdown(false);
                      onCreateNewGroup();
                    }}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    <Plus size={12} />
                    <span>Nuevo</span>
                  </button>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0' }}>
                  {groupsIndex.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        onSelectGroup(g.id);
                        setShowEventDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-inputs)',
                        background: g.id === group.id ? 'var(--color-silver-light)' : 'transparent',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: g.id === group.id ? 600 : 500, color: 'var(--color-graphite)' }}>
                        {g.title || 'Sin título'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>
                        {g.participantCount} personas • {g.expenseCount} gastos
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onCopyLink}
            title="Copiar enlace para compartir con amigos"
          >
            {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
            <span>{copiedLink ? 'Link Copiado' : 'Link de Grupo'}</span>
          </button>

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
