import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, PieChart, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface BudgetWithSpending {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  amount: number;
  spent: number;
  month: number;
  year: number;
}

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    month: currentMonth,
    year: currentYear,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_system.eq.true`);

      setCategories(categoriesData || []);

      // Fetch budgets for current month
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select(`
          *,
          categories (name, color)
        `)
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (budgetsData) {
        // Fetch spending for each budget category
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        const { data: transactions } = await supabase
          .from('transactions')
          .select('category_id, amount')
          .eq('user_id', user.id)
          .eq('transaction_type', 'Debit')
          .gte('transaction_date', monthStart.toISOString().split('T')[0])
          .lte('transaction_date', monthEnd.toISOString().split('T')[0]);

        const spendingByCategory = (transactions || []).reduce((acc: Record<string, number>, tx) => {
          if (tx.category_id) {
            acc[tx.category_id] = (acc[tx.category_id] || 0) + Number(tx.amount);
          }
          return acc;
        }, {});

        const budgetsWithSpending: BudgetWithSpending[] = budgetsData.map(budget => ({
          id: budget.id,
          category_id: budget.category_id,
          category_name: budget.categories?.name || 'Unknown',
          category_color: budget.categories?.color || '#94A3B8',
          amount: Number(budget.amount),
          spent: spendingByCategory[budget.category_id] || 0,
          month: budget.month,
          year: budget.year,
        }));

        setBudgets(budgetsWithSpending);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast.error('Failed to load budgets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('budgets')
        .upsert({
          user_id: user.id,
          category_id: formData.category_id,
          amount: parseFloat(formData.amount),
          month: formData.month,
          year: formData.year,
        }, {
          onConflict: 'user_id,category_id,month,year'
        });

      if (error) throw error;

      toast.success('Budget saved successfully');
      setIsDialogOpen(false);
      setFormData({
        category_id: '',
        amount: '',
        month: currentMonth,
        year: currentYear,
      });
      fetchData();
    } catch (error: any) {
      console.error('Error saving budget:', error);
      toast.error(error.message || 'Failed to save budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Budgets</h1>
          <p className="text-muted-foreground">Track your spending limits for {format(now, 'MMMM yyyy')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Set Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Category Budget</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Monthly Limit</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Budget'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall Progress */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Budget Progress</p>
              <p className="text-2xl font-semibold font-mono mt-1">
                ₹{totalSpent.toLocaleString('en-IN')} 
                <span className="text-muted-foreground text-lg"> / ₹{totalBudget.toLocaleString('en-IN')}</span>
              </p>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              overallProgress > 100 
                ? "bg-expense/10 text-expense"
                : overallProgress > 80
                ? "bg-amber-500/10 text-amber-600"
                : "bg-income/10 text-income"
            )}>
              {overallProgress > 100 ? (
                <><AlertTriangle className="h-4 w-4" /> Over budget</>
              ) : (
                <><CheckCircle className="h-4 w-4" /> {overallProgress.toFixed(0)}% used</>
              )}
            </div>
          </div>
          <Progress 
            value={Math.min(overallProgress, 100)} 
            className={cn(
              "h-2",
              overallProgress > 100 && "[&>div]:bg-expense"
            )}
          />
        </CardContent>
      </Card>

      {/* Budget Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-border/50 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No budgets set for this month. Create your first budget to start tracking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const progress = (budget.spent / budget.amount) * 100;
            const remaining = budget.amount - budget.spent;
            const isOverBudget = budget.spent > budget.amount;

            return (
              <Card key={budget.id} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: budget.category_color }}
                      />
                      <h3 className="font-medium">{budget.category_name}</h3>
                    </div>
                    {isOverBudget && (
                      <AlertTriangle className="h-5 w-5 text-expense" />
                    )}
                  </div>

                  <Progress 
                    value={Math.min(progress, 100)} 
                    className={cn(
                      "h-2 mb-4",
                      isOverBudget && "[&>div]:bg-expense"
                    )}
                  />

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Spent</p>
                      <p className={cn(
                        "font-mono font-medium",
                        isOverBudget && "text-expense"
                      )}>
                        ₹{budget.spent.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {isOverBudget ? 'Over by' : 'Remaining'}
                      </p>
                      <p className={cn(
                        "font-mono font-medium",
                        isOverBudget ? "text-expense" : "text-income"
                      )}>
                        ₹{Math.abs(remaining).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
