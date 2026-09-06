import type { FairShareGroup, GroupSummary } from '../types/fairshare';

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

const getIndexKey = (userId = 'guest') => `fairshare_groups_index_${userId}`;
const getActiveKey = (userId = 'guest') => `fairshare_active_id_${userId}`;
const getGroupKey = (userId = 'guest', groupId: string) => `fairshare_group_${userId}_${groupId}`;

/**
 * Returns summary list of all saved groups for the active user.
 */
export const getStoredGroupsIndex = (userId = 'guest'): GroupSummary[] => {
  try {
    const raw = localStorage.getItem(getIndexKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const updateStoredGroupsIndex = (group: FairShareGroup, userId = 'guest') => {
  try {
    const index = getStoredGroupsIndex(userId);
    const existingIdx = index.findIndex((g) => g.id === group.id);
    const summary: GroupSummary = {
      id: group.id,
      title: group.title,
      updatedAt: group.updatedAt,
      expenseCount: group.expenses.length,
      participantCount: group.participants.length,
    };

    if (existingIdx >= 0) {
      index[existingIdx] = summary;
    } else {
      index.unshift(summary);
    }

    localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
  } catch (err) {
    console.error('Error actualizando índice:', err);
  }
};

/**
 * Gets a specific group by ID for a user.
 */
export const getStoredGroupById = (groupId: string, userId = 'guest'): FairShareGroup | null => {
  try {
    const raw = localStorage.getItem(getGroupKey(userId, groupId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Loads current active group for a user.
 */
export const getStoredGroup = (userId = 'guest', preferredId?: string): FairShareGroup => {
  try {
    const targetId = preferredId || localStorage.getItem(getActiveKey(userId));
    if (targetId) {
      const found = getStoredGroupById(targetId, userId);
      if (found) return found;
    }

    // Check index
    const index = getStoredGroupsIndex(userId);
    if (index.length > 0) {
      const first = getStoredGroupById(index[0].id, userId);
      if (first) return first;
    }

    const newGroup = createEmptyGroup();
    saveStoredGroup(newGroup, userId);
    return newGroup;
  } catch (err) {
    console.error('Error al cargar grupo:', err);
    return createEmptyGroup();
  }
};

/**
 * Saves group to LocalStorage per-user and updates index.
 */
export const saveStoredGroup = (group: FairShareGroup, userId = 'guest'): void => {
  try {
    const updated = { ...group, updatedAt: new Date().toISOString() };
    localStorage.setItem(getGroupKey(userId, group.id), JSON.stringify(updated));
    localStorage.setItem(getActiveKey(userId), group.id);
    updateStoredGroupsIndex(updated, userId);
  } catch (err) {
    console.error('Error al guardar grupo:', err);
  }
};

/**
 * Deletes a group from LocalStorage for a user.
 */
export const deleteStoredGroup = (groupId: string, userId = 'guest'): void => {
  try {
    localStorage.removeItem(getGroupKey(userId, groupId));
    const index = getStoredGroupsIndex(userId).filter((g) => g.id !== groupId);
    localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
  } catch (err) {
    console.error('Error al eliminar grupo:', err);
  }
};
