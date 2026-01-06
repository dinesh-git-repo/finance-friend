import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_type: 'Credit' | 'Debit';
  transaction_date: string;
  party?: string;
  category_name?: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export function RecentTransactions({ transactions, isLoading }: RecentTransactionsProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-4 bg-muted rounded w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No transactions yet. Add your first transaction to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center gap-4">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full",
                transaction.transaction_type === 'Credit' 
                  ? "bg-income/10 text-income" 
                  : "bg-expense/10 text-expense"
              )}>
                {transaction.transaction_type === 'Credit' 
                  ? <ArrowDownLeft className="h-4 w-4" />
                  : <ArrowUpRight className="h-4 w-4" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {transaction.description || transaction.party || 'Transaction'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(transaction.transaction_date), 'MMM d')}</span>
                  {transaction.category_name && (
                    <>
                      <span>•</span>
                      <span>{transaction.category_name}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={cn(
                "font-mono font-medium text-sm",
                transaction.transaction_type === 'Credit' ? "text-income" : "text-expense"
              )}>
                {transaction.transaction_type === 'Credit' ? '+' : '-'}
                ₹{transaction.amount.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
