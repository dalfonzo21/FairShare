import React from 'react';
import { 
  Utensils, 
  ShoppingCart, 
  Wine, 
  Car, 
  Home, 
  Ticket, 
  Gamepad2, 
  Tag 
} from 'lucide-react';
import type { ExpenseCategory } from '../types/fairshare';

interface CategoryIconProps {
  category: ExpenseCategory;
  size?: number;
  showBackground?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category, 
  size = 18, 
  showBackground = false 
}) => {
  const renderIcon = () => {
    switch (category) {
      case 'food':
        return <Utensils size={size} />;
      case 'groceries':
        return <ShoppingCart size={size} />;
      case 'drinks':
        return <Wine size={size} />;
      case 'transport':
        return <Car size={size} />;
      case 'accommodation':
        return <Home size={size} />;
      case 'tickets':
        return <Ticket size={size} />;
      case 'entertainment':
        return <Gamepad2 size={size} />;
      case 'other':
      default:
        return <Tag size={size} />;
    }
  };

  if (showBackground) {
    return (
      <div className="category-icon-box">
        {renderIcon()}
      </div>
    );
  }

  return (
    <span style={{ color: 'var(--color-graphite)', display: 'inline-flex', alignItems: 'center' }}>
      {renderIcon()}
    </span>
  );
};
