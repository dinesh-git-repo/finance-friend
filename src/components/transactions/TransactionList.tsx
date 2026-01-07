import { useMemo } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import TransactionRow from './TransactionRow';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  transaction_date: string;
  description?: string;
  party?: string;
  amount: number;
  transaction_type: 'Debit' | 'Credit';
  categories?: { name: string; color?: string } | null;
  accounts?: { name: string; account_type?: string } | null;
  transaction_mode?: string | null;
  transaction_nature?: string | null;
}

interface TransactionListProps {
  transactions: Transaction[];
  onTransactionClick?: (transaction: Transaction) => void;
}

interface GroupedTransactions {
  date: string;
  displayDate: string;
  transactions: Transaction[];
  totalDebit: number;
  totalCredit: number;
}

export default function TransactionList({ transactions, onTransactionClick }: TransactionListProps) {
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, GroupedTransactions> = {};

    transactions.forEach((transaction) => {
      const date = transaction.transaction_date;
      
      if (!groups[date]) {
        const parsedDate = parseISO(date);
        let displayDate: string;

        if (isToday(parsedDate)) {
          displayDate = 'Today';
        } else if (isYesterday(parsedDate)) {
          displayDate = 'Yesterday';
        } else {
          displayDate = format(parsedDate, 'MMMM d, yyyy');
        }

        groups[date] = {
          date,
          displayDate,
          transactions: [],
          totalDebit: 0,
          totalCredit: 0,
        };
      }

      groups[date].transactions.push(transaction);

      if (transaction.transaction_type === 'Debit') {
        groups[date].totalDebit += Number(transaction.amount);
      } else {
        groups[date].totalCredit += Number(transaction.amount);
      }
    });

    // Sort by date descending
    return Object.values(groups).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-muted-foreground">No transactions found</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Try adjusting your filters or add a new transaction
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {groupedTransactions.map((group) => (
        <div key={group.date}>
          {/* Date Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {group.displayDate}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {group.totalCredit > 0 && (
                <span className="text-income font-medium">
                  +₹{group.totalCredit.toLocaleString('en-IN')}
                </span>
              )}
              {group.totalDebit > 0 && (
                <span className="text-muted-foreground font-medium">
                  -₹{group.totalDebit.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {/* Transactions */}
          <div>
            {group.transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onClick={() => onTransactionClick?.(transaction)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
