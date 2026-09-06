import type { FairShareGroup } from '../types/fairshare';

const STORAGE_KEY = 'fairshare_active_group_v1';

export const AVATAR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#E11D48', // Rose
];

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
};

export const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getRandomAvatarColor = (index?: number): string => {
  if (typeof index === 'number') {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
};

export const createEmptyGroup = (title = 'Mi Evento / Viaje'): FairShareGroup => {
  return {
    id: generateId(),
    title,
    currency: '$',
    participants: [],
    expenses: [],
    settledTransactions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const getStoredGroup = (): FairShareGroup => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const empty = createEmptyGroup('Mi Evento / Viaje');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      return empty;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading from storage:', err);
    return createEmptyGroup();
  }
};

export const saveStoredGroup = (group: FairShareGroup): void => {
  try {
    const updated = { ...group, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving to storage:', err);
  }
};

export const clearStoredGroup = (): FairShareGroup => {
  const empty = createEmptyGroup();
  saveStoredGroup(empty);
  return empty;
};
