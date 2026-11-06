export type ExpenseCategory = 
  | 'food' 
  | 'transport' 
  | 'drinks' 
  | 'accommodation' 
  | 'tickets' 
  | 'groceries' 
  | 'entertainment' 
  | 'other';

export interface CategoryInfo {
  id: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
}

export const CATEGORIES: Record<ExpenseCategory, CategoryInfo> = {
  food: { id: 'food', label: 'Comida / Restaurante', icon: 'Utensils', color: '#F59E0B' },
  groceries: { id: 'groceries', label: 'Supermercado / Asado', icon: 'ShoppingCart', color: '#10B981' },
  drinks: { id: 'drinks', label: 'Bebidas / Fiesta', icon: 'Wine', color: '#8B5CF6' },
  transport: { id: 'transport', label: 'Transporte / Gasolina', icon: 'Car', color: '#3B82F6' },
  accommodation: { id: 'accommodation', label: 'Hospedaje / Casa', icon: 'Home', color: '#EC4899' },
  tickets: { id: 'tickets', label: 'Entradas / Eventos', icon: 'Ticket', color: '#6366F1' },
  entertainment: { id: 'entertainment', label: 'Entretenimiento', icon: 'Gamepad2', color: '#14B8A6' },
  other: { id: 'other', label: 'Otros Gastos', icon: 'Tag', color: '#64748B' },
};

export interface Person {
  id: string;
  name: string;
  color: string;
  avatarIcon?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  assignedTo: string[]; // List of Person IDs sharing this item
  paidBy?: string; // Optional: who paid for this item if different
  payers?: ExpensePayer[]; // Optional: multiple payers for this item
}

export interface ExpensePayer {
  personId: string;
  amount: number;
}

export interface ExpenseSplit {
  personId: string;
  amount: number;
}

export type SplitType = 'equal' | 'exact' | 'items';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string; // Person ID who paid the bill (or primary payer for backward compatibility)
  splitAmong: string[]; // List of Person IDs who share this expense
  category: ExpenseCategory;
  date: string; // ISO date string (YYYY-MM-DD)
  notes?: string;

  // Advanced features: Multi-payer ("Vaca") & Itemized breakdown
  splitType?: SplitType;
  payers?: ExpensePayer[];
  items?: ExpenseItem[];
  customSplits?: ExpenseSplit[];
  extraFee?: number; // Optional service fee, tip, or tax in itemized mode
  extraFeeSplitType?: 'all' | 'item_consumers';
}

export interface PersonBalance {
  person: Person;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = receives money, negative = owes money
}

export interface SettlementTransaction {
  id: string;
  fromPerson: Person;
  toPerson: Person;
  amount: number;
  isSettled?: boolean;
}

export type PaymentMethod = 'transfer' | 'cash';
export type CashRoundingScale = 0.01 | 0.05 | 0.10 | 0.25 | 0.50 | 1.00;
export type CashRoundingStrategy = 'nearest' | 'up' | 'down';
export type SurplusDestination = 'tip_pool' | 'creditor' | 'debtor_discount';

export interface CashRoundingOptions {
  scale: CashRoundingScale;
  strategy: CashRoundingStrategy;
  surplusDestination: SurplusDestination;
}

export interface CashSettlementDetail {
  transactionId: string;
  fromPerson: Person;
  toPerson: Person;
  exactAmount: number;
  cashAmount: number;
  difference: number; // cashAmount - exactAmount (+ is surplus, - is discount)
  isSettled?: boolean;
}

export interface CashSettlementSummary {
  details: CashSettlementDetail[];
  totalExact: number;
  totalCash: number;
  totalSurplus: number;
  scale: CashRoundingScale;
  strategy: CashRoundingStrategy;
  surplusDestination: SurplusDestination;
}

export interface FairShareGroup {
  id: string;
  title: string;
  currency: string;
  participants: Person[];
  expenses: Expense[];
  settledTransactions: string[]; // IDs of settled transactions
  createdAt: string;
  updatedAt: string;
}

export interface GroupSummary {
  id: string;
  title: string;
  updatedAt: string;
  expenseCount: number;
  participantCount: number;
}
