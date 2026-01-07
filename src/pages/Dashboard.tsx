import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { AccountBalances } from '@/components/dashboard/AccountBalances';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowLeftRight,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netCashflow: 0,
    totalBalance: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [cashflowData, setCashflowData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // Fetch current month stats
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch transactions for current month
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (name, color)
        `)
        .eq('user_id', user.id)
        .gte('transaction_date', monthStart.toISOString().split('T')[0])
        .lte('transaction_date', monthEnd.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (transactions) {
        const income = transactions
          .filter(t => t.transaction_type === 'Credit')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const expenses = transactions
          .filter(t => t.transaction_type === 'Debit')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        setStats(prev => ({
          ...prev,
          totalIncome: income,
          totalExpenses: expenses,
          netCashflow: income - expenses,
        }));

        // Recent transactions
        setRecentTransactions(transactions.slice(0, 5).map(t => ({
          ...t,
          category_name: t.categories?.name,
        })));

        // Category breakdown
        const categoryTotals = transactions
          .filter(t => t.transaction_type === 'Debit')
          .reduce((acc: Record<string, { total: number; color: string }>, t) => {
            const categoryName = t.categories?.name || 'Uncategorized';
            const categoryColor = t.categories?.color || '#94A3B8';
            if (!acc[categoryName]) {
              acc[categoryName] = { total: 0, color: categoryColor };
            }
            acc[categoryName].total += Number(t.amount);
            return acc;
          }, {});

        setCategoryData(
          Object.entries(categoryTotals)
            .map(([name, data]) => ({ name, value: data.total, color: data.color }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
        );
      }

      // Fetch accounts
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (accountsData) {
        setAccounts(accountsData);
        const totalBalance = accountsData.reduce((sum, acc) => sum + Number(acc.closing_balance || 0), 0);
        setStats(prev => ({ ...prev, totalBalance }));
      }

      // Fetch cashflow for last 6 months
      const cashflowMonths: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);

        const { data: monthTx } = await supabase
          .from('transactions')
          .select('amount, transaction_type')
          .eq('user_id', user.id)
          .gte('transaction_date', start.toISOString().split('T')[0])
          .lte('transaction_date', end.toISOString().split('T')[0]);

        const income = monthTx?.filter(t => t.transaction_type === 'Credit')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expenses = monthTx?.filter(t => t.transaction_type === 'Debit')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        cashflowMonths.push({
          month: format(monthDate, 'MMM'),
          income,
          expenses,
        });
      }
      setCashflowData(cashflowMonths);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with quick actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ''}
          </h1>
          <p className="text-muted-foreground">Here's your financial overview for {format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <Button asChild>
          <Link to="/transactions">
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Income"
          value={`₹${stats.totalIncome.toLocaleString('en-IN')}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="income"
        />
        <StatCard
          title="Total Expenses"
          value={`₹${stats.totalExpenses.toLocaleString('en-IN')}`}
          icon={<TrendingDown className="h-5 w-5" />}
          variant="expense"
        />
        <StatCard
          title="Net Cashflow"
          value={`₹${Math.abs(stats.netCashflow).toLocaleString('en-IN')}`}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          variant={stats.netCashflow >= 0 ? 'income' : 'expense'}
        />
        <StatCard
          title="Total Balance"
          value={`₹${stats.totalBalance.toLocaleString('en-IN')}`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CashflowChart data={cashflowData} isLoading={isLoading} />
        <CategoryBreakdown data={categoryData} isLoading={isLoading} />
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions transactions={recentTransactions} isLoading={isLoading} />
        <AccountBalances accounts={accounts} isLoading={isLoading} />
      </div>
    </div>
  );
}
