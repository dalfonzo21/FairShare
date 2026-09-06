import type { FairShareGroup, GroupSummary } from '../types/fairshare';

const ACTIVE_GROUP_ID_KEY = 'fairshare_active_group_id';
const GROUPS_STORAGE_PREFIX = 'fairshare_group_';
const GROUPS_INDEX_KEY = 'fairshare_groups_index_v1';

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

/**
 * Returns summary list of all saved groups.
 */
export const getStoredGroupsIndex = (): GroupSummary[] => {
  try {
    const raw = localStorage.getItem(GROUPS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const updateStoredGroupsIndex = (group: FairShareGroup) => {
  try {
    const index = getStoredGroupsIndex();
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

    localStorage.setItem(GROUPS_INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    console.error('Error actualizando índice de grupos:', err);
  }
};

/**
 * Gets a specific group by ID.
 */
export const getStoredGroupById = (id: string): FairShareGroup | null => {
  try {
    const raw = localStorage.getItem(`${GROUPS_STORAGE_PREFIX}${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Loads current active group, or falls back to first saved group, or creates empty.
 */
export const getStoredGroup = (preferredId?: string): FairShareGroup => {
  try {
    const targetId = preferredId || localStorage.getItem(ACTIVE_GROUP_ID_KEY);
    if (targetId) {
      const found = getStoredGroupById(targetId);
      if (found) return found;
    }

    // Check index
    const index = getStoredGroupsIndex();
    if (index.length > 0) {
      const first = getStoredGroupById(index[0].id);
      if (first) return first;
    }

    const newGroup = createEmptyGroup();
    saveStoredGroup(newGroup);
    return newGroup;
  } catch (err) {
    console.error('Error al cargar grupo:', err);
    return createEmptyGroup();
  }
};

/**
 * Saves group to LocalStorage and updates index.
 */
export const saveStoredGroup = (group: FairShareGroup): void => {
  try {
    const updated = { ...group, updatedAt: new Date().toISOString() };
    localStorage.setItem(`${GROUPS_STORAGE_PREFIX}${group.id}`, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_GROUP_ID_KEY, group.id);
    updateStoredGroupsIndex(updated);
  } catch (err) {
    console.error('Error al guardar grupo:', err);
  }
};

/**
 * Deletes a group from LocalStorage.
 */
export const deleteStoredGroup = (id: string): void => {
  try {
    localStorage.removeItem(`${GROUPS_STORAGE_PREFIX}${id}`);
    const index = getStoredGroupsIndex().filter((g) => g.id !== id);
    localStorage.setItem(GROUPS_INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    console.error('Error al eliminar grupo:', err);
  }
};
