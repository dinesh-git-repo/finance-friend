import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Wallet, 
  Building2, 
  CreditCard, 
  PiggyBank,
  Smartphone,
  TrendingUp,
  Landmark,
  Shield
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  account_type: string;
  balance: number;
  currency: string;
}

interface AccountBalancesProps {
  accounts: Account[];
  isLoading?: boolean;
}

const accountTypeIcons: Record<string, typeof Wallet> = {
  'Cash': Wallet,
  'Bank Account': Building2,
  'Savings Account': PiggyBank,
  'Salary Account': Landmark,
  'Credit Card': CreditCard,
  'Wallet': Smartphone,
  'Demat Account': TrendingUp,
  'Loan Account': Landmark,
  'Insurance Account': Shield,
};

export function AccountBalances({ accounts, isLoading }: AccountBalancesProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-muted" />
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

  if (accounts.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No accounts added yet. Add your first account to track balances.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Account Balances</CardTitle>
        <span className="text-sm font-mono font-medium text-primary">
          ₹{totalBalance.toLocaleString('en-IN')}
        </span>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts.map((account) => {
            const Icon = accountTypeIcons[account.account_type] || Wallet;
            const isNegative = account.balance < 0;
            
            return (
              <div key={account.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{account.account_type}</p>
                </div>
                <span className={cn(
                  "font-mono font-medium text-sm",
                  isNegative ? "text-expense" : "text-foreground"
                )}>
                  ₹{Math.abs(account.balance).toLocaleString('en-IN')}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
