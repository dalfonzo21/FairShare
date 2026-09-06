import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { loginWithGoogle, loginWithEmail, registerWithEmail } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userName: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = await loginWithGoogle();
      if (user) {
        onSuccess(user.displayName || user.email || 'Usuario');
        onClose();
      }
    } catch (err: unknown) {
      console.error('Google Auth Error:', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('auth/unauthorized-domain')) {
        setError('Dominio no autorizado. Agrega tu dominio de Vercel en Firebase Console -> Authentication -> Configuración -> Dominios autorizados.');
      } else if (errMsg.includes('auth/popup-closed-by-user')) {
        setError('Inicio de sesión cancelado.');
      } else {
        setError('No se pudo iniciar sesión con Google. Verifica la configuración de Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isRegister) {
        const user = await registerWithEmail(email.trim(), password);
        if (user) {
          onSuccess(user.displayName || user.email || 'Usuario');
          onClose();
        }
      } else {
        const user = await loginWithEmail(email.trim(), password);
        if (user) {
          onSuccess(user.displayName || user.email || 'Usuario');
          onClose();
        }
      }
    } catch (err: unknown) {
      console.error('Email Auth Error:', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('auth/invalid-credential') || errMsg.includes('auth/wrong-password') || errMsg.includes('auth/user-not-found')) {
        setError('Correo o contraseña incorrectos.');
      } else if (errMsg.includes('auth/email-already-in-use')) {
        setError('Este correo ya está registrado. Intenta iniciar sesión.');
      } else if (errMsg.includes('auth/weak-password')) {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError('Ocurrió un error. Verifica tus datos e intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger-border)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-inputs)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* 1-Click Google Sign In */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '10px 16px', gap: '10px', fontSize: '14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continuar con Google</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-silver)' }} />
            <span style={{ fontSize: '11px', color: 'var(--color-slate)', textTransform: 'uppercase' }}>
              o con correo
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-silver)' }} />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '10px 16px', marginTop: '4px' }}
            >
              {isRegister ? <UserPlus size={15} /> : <LogIn size={15} />}
              <span>{loading ? 'Cargando...' : isRegister ? 'Registrarme' : 'Iniciar Sesión'}</span>
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div style={{ textAlign: 'center', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              style={{ fontSize: '12px' }}
            >
              {isRegister
                ? '¿Ya tienes una cuenta? Inicia sesión'
                : '¿No tienes cuenta todavía? Regístrate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
