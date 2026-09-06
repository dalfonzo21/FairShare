import React, { useState } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus 
} from 'lucide-react';
import type { Person, PersonBalance } from '../types/fairshare';
import { getInitials, getRandomAvatarColor, AVATAR_COLORS } from '../services/storage';
import { formatCurrency } from '../utils/settlement';

interface ParticipantListProps {
  participants: Person[];
  balances: PersonBalance[];
  currency: string;
  onAddParticipant: (name: string, color: string) => void;
  onRemoveParticipant: (id: string) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  balances,
  currency,
  onAddParticipant,
  onRemoveParticipant,
}) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  const balanceMap = new Map<string, PersonBalance>();
  balances.forEach((b) => balanceMap.set(b.person.id, b));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddParticipant(name.trim(), selectedColor);
    setName('');
    setSelectedColor(getRandomAvatarColor(participants.length + 1));
  };

  return (
    <div className="glass-panel animate-fade">
      <div className="panel-header">
        <h3 className="panel-title">
          <Users size={18} />
          <span>Participantes ({participants.length})</span>
        </h3>
      </div>

      {/* Add Participant Input Form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Nombre de la persona..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            <UserPlus size={14} />
            <span>Agregar</span>
          </button>
        </div>

        {/* Color Picker palette row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-slate)' }}>Tono:</span>
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: color,
                border: selectedColor === color ? '2px solid var(--color-ink)' : '2px solid transparent',
                transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </form>

      {/* Participant List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {participants.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <div className="empty-icon">
              <Users size={20} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-slate)' }}>No hay participantes todavía.</p>
            <span style={{ fontSize: '12px', color: 'var(--color-stone)' }}>Ingresa nombres arriba para empezar.</span>
          </div>
        ) : (
          participants.map((person) => {
            const balanceInfo = balanceMap.get(person.id);
            const net = balanceInfo ? balanceInfo.netBalance : 0;
            const paid = balanceInfo ? balanceInfo.totalPaid : 0;

            let badgeClass = 'badge-neutral';
            let icon = <Minus size={11} />;
            let label = 'Al día';

            if (net > 0.009) {
              badgeClass = 'badge-positive';
              icon = <TrendingUp size={11} />;
              label = `+${formatCurrency(net, currency)}`;
            } else if (net < -0.009) {
              badgeClass = 'badge-negative';
              icon = <TrendingDown size={11} />;
              label = formatCurrency(net, currency);
            }

            return (
              <div key={person.id} className="participant-card">
                <div className="participant-meta">
                  <div className="avatar-circle" style={{ backgroundColor: person.color, color: '#ffffff' }}>
                    {getInitials(person.name)}
                  </div>
                  <div className="participant-name-box">
                    <div className="participant-name">{person.name}</div>
                    <div className="participant-sub">
                      Pagó {formatCurrency(paid, currency)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge-balance ${badgeClass}`}>
                    {icon}
                    <span>{label}</span>
                  </span>

                  <button
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => onRemoveParticipant(person.id)}
                    title="Eliminar participante"
                    style={{ padding: '6px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
