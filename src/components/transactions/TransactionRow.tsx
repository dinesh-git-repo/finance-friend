import { Badge } from '@/components/ui/badge';
import { ChevronRight, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

// Category emoji mapping
const CATEGORY_ICONS: Record<string, string> = {
  'Food': '🍔',
  'Food & Dining': '🍽️',
  'Groceries': '🛒',
  'Transport': '🚗',
  'Transportation': '🚗',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Entertainment & Recreation': '🎬',
  'Bills': '📄',
  'Utilities': '💡',
  'Health': '💊',
  'Medical': '💊',
  'Personal': '👤',
  'Income': '💰',
  'Salary': '💵',
  'Transfer': '🔄',
  'Money Transfer': '🔄',
  'Investment': '📈',
  'Education': '📚',
  'Travel': '✈️',
  'Miscellaneous': '📦',
  'Refund': '↩️',
  'Rewards': '🎁',
  'Subscription': '📺',
  'Rent': '🏠',
  'Insurance': '🛡️',
  'Clothing': '👕',
  'Restaurants & Bars': '🍴',
  'Financial & Legal Services': '📋',
  'People': '👥',
};

interface TransactionRowProps {
  transaction: {
    id: string;
    description?: string;
    party?: string;
    amount: number;
    transaction_type: 'Debit' | 'Credit';
    categories?: { name: string; color?: string } | null;
    accounts?: { name: string; account_type?: string } | null;
    transaction_mode?: string | null;
    transaction_nature?: string | null;
  };
  onClick?: () => void;
}

export default function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const categoryName = transaction.categories?.name || 'Miscellaneous';
  const categoryEmoji = CATEGORY_ICONS[categoryName] || CATEGORY_ICONS[transaction.transaction_nature || ''] || '📦';
  const displayName = transaction.party || transaction.description || 'Transaction';
  const accountName = transaction.accounts?.name;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 py-3 px-4 hover:bg-accent/50 cursor-pointer transition-colors",
        "border-b border-border/40 last:border-b-0"
      )}
      onClick={onClick}
    >
      {/* Avatar/Icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center text-lg">
        {categoryEmoji}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {displayName}
        </p>
        {transaction.description && transaction.party && (
          <p className="text-xs text-muted-foreground truncate">
            {transaction.description}
          </p>
        )}
      </div>

      {/* Category Badge */}
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <Badge
          variant="secondary"
          className="font-normal text-xs px-2 py-0.5"
          style={{
            backgroundColor: transaction.categories?.color ? `${transaction.categories.color}15` : undefined,
            color: transaction.categories?.color || undefined,
          }}
        >
          <span className="mr-1">{categoryEmoji}</span>
          {categoryName}
        </Badge>
      </div>

      {/* Account */}
      {accountName && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 min-w-[120px]">
          <CreditCard className="h-3.5 w-3.5" />
          <span className="truncate max-w-[100px]">{accountName}</span>
        </div>
      )}

      {/* Amount */}
      <div
        className={cn(
          "font-mono font-medium text-sm flex-shrink-0 min-w-[80px] text-right",
          transaction.transaction_type === 'Credit' ? 'text-income' : 'text-foreground'
        )}
      >
        {transaction.transaction_type === 'Credit' ? '+' : ''}
        ₹{Number(transaction.amount).toLocaleString('en-IN')}
      </div>

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
    </div>
  );
}

export { CATEGORY_ICONS };
