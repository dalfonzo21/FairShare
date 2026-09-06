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
  User as UserIcon,
  LogOut,
  X
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { FairShareGroup, GroupSummary } from '../types/fairshare';
import { getInitials } from '../services/storage';

interface HeaderProps {
  group: FairShareGroup;
  groupsIndex: GroupSummary[];
  currentUser: User | null;
  onSelectGroup: (groupId: string) => void;
  onCreateNewGroup: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateCurrency: (currency: string) => void;
  onReset: () => void;
  onShare: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  copied: boolean;
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
  currentUser,
  onSelectGroup,
  onCreateNewGroup,
  onUpdateTitle,
  onUpdateCurrency,
  onReset,
  onShare,
  onOpenAuth,
  onLogout,
  copied,
  isCloud,
}) => {
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Mi Cuenta';

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

          {/* Cloud Indicator */}
          <div 
            title={isCloud ? (currentUser ? 'Sincronizado en tu cuenta' : 'Conectado a la nube') : 'Guardado en tu navegador (Local)'}
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
            <span>{isCloud ? (currentUser ? 'Nube' : 'Online') : 'Local'}</span>
          </div>
        </div>

        <div className="header-actions">
          {/* Multiple Trips / Events Selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowEventDropdown(!showEventDropdown)}
              title="Ver mis eventos o viajes guardados"
            >
              <FolderOpen size={14} />
              <span>Mis Eventos ({groupsIndex.length})</span>
            </button>

            {showEventDropdown && (
              <>
                {/* Backdrop for closing when clicking outside */}
                <div 
                  className="dropdown-backdrop"
                  onClick={() => setShowEventDropdown(false)}
                />

                <div className="events-dropdown-menu animate-fade">
                  <div className="events-dropdown-header">
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-slate)', textTransform: 'uppercase' }}>
                      Mis Eventos
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setShowEventDropdown(false);
                          onCreateNewGroup();
                        }}
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <Plus size={12} />
                        <span>Nuevo</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-sm close-dropdown-btn"
                        onClick={() => setShowEventDropdown(false)}
                        style={{ padding: '4px' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="events-dropdown-list">
                    {groupsIndex.length === 0 ? (
                      <div style={{ padding: '16px 8px', fontSize: '12px', color: 'var(--color-slate)', textAlign: 'center' }}>
                        No tienes otros eventos creados aún.
                      </div>
                    ) : (
                      groupsIndex.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            onSelectGroup(g.id);
                            setShowEventDropdown(false);
                          }}
                          className={`event-dropdown-item ${g.id === group.id ? 'active' : ''}`}
                        >
                          <span className="event-item-title">
                            {g.title || 'Sin título'}
                          </span>
                          <span className="event-item-meta">
                            {g.participantCount} personas • {g.expenseCount} gastos
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={onReset}
            title="Empezar desde cero este evento"
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

          {/* User Auth Profile / Login Button */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
              <div
                className="avatar-circle"
                style={{
                  backgroundColor: 'var(--color-ink)',
                  width: 28,
                  height: 28,
                  fontSize: '11px',
                  fontWeight: 600,
                }}
                title={currentUser.email || displayName}
              >
                {getInitials(displayName)}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onLogout}
                title="Cerrar sesión"
                style={{ padding: '6px' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenAuth}
              style={{ marginLeft: '4px' }}
            >
              <UserIcon size={14} />
              <span>Iniciar Sesión</span>
            </button>
          )}
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
