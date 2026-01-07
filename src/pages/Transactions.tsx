import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import CSVImportDialog from '@/components/transactions/CSVImportDialog';
import TransactionFilters, { FilterState } from '@/components/transactions/TransactionFilters';
import TransactionList from '@/components/transactions/TransactionList';
import TransactionDetailSheet from '@/components/transactions/TransactionDetailSheet';
import { isWithinInterval, parseISO } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type TransactionType = Database['public']['Enums']['transaction_type'];
type TransactionMode = Database['public']['Enums']['transaction_mode'];
type TransactionNature = Database['public']['Enums']['transaction_nature'];

interface TransactionFormData {
  transaction_date: string;
  amount: string;
  transaction_type: TransactionType;
  description: string;
  party: string;
  bank_remarks: string;
  account_id: string;
  category_id: string;
  transaction_mode: TransactionMode | '';
  transaction_nature: TransactionNature | '';
  tag: string;
  group_name: string;
}

const initialFormData: TransactionFormData = {
  transaction_date: new Date().toISOString().split('T')[0],
  amount: '',
  transaction_type: 'Debit',
  description: '',
  party: '',
  bank_remarks: '',
  account_id: '',
  category_id: '',
  transaction_mode: '',
  transaction_nature: '',
  tag: '',
  group_name: '',
};

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateRange: undefined,
    type: 'all',
    categoryId: '',
    accountId: '',
  });
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteAllTransactions = async () => {
    if (!user) return;
    setIsDeletingAll(true);
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast.success(`Deleted ${transactions.length} transactions`);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting transactions:', error);
      toast.error(error.message || 'Failed to delete transactions');
    } finally {
      setIsDeletingAll(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const [transactionsRes, accountsRes, categoriesRes, subcategoriesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            *,
            accounts (name, account_type),
            categories (name, icon)
          `)
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('categories')
          .select('*')
          .or(`user_id.eq.${user.id},is_system.eq.true`),
        supabase
          .from('subcategories')
          .select('*'),
      ]);

      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (subcategoriesRes.data) setSubcategories(subcategoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.account_id) {
      toast.error('Please select an account');
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionData: any = {
        user_id: user.id,
        transaction_date: formData.transaction_date,
        amount: parseFloat(formData.amount),
        transaction_type: formData.transaction_type,
        description: formData.description || null,
        party: formData.party || null,
        bank_remarks: formData.bank_remarks || null,
        account_id: formData.account_id,
        category_id: formData.category_id || null,
        transaction_mode: formData.transaction_mode || null,
        transaction_nature: formData.transaction_nature || null,
        tag: formData.tag || null,
        group_name: formData.group_name || null,
      };

      const { error } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (error) throw error;

      toast.success('Transaction added successfully');
      setIsDialogOpen(false);
      setFormData(initialFormData);
      fetchData();
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      toast.error(error.message || 'Failed to add transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Search filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matches = 
          t.description?.toLowerCase().includes(query) ||
          t.party?.toLowerCase().includes(query) ||
          t.bank_remarks?.toLowerCase().includes(query) ||
          t.tag?.toLowerCase().includes(query) ||
          t.group_name?.toLowerCase().includes(query) ||
          t.category_name?.toLowerCase().includes(query) ||
          t.categories?.name?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Type filter
      if (filters.type !== 'all' && t.transaction_type !== filters.type) {
        return false;
      }

      // Category filter
      if (filters.categoryId && t.category_id !== filters.categoryId) {
        return false;
      }

      // Account filter
      if (filters.accountId && t.account_id !== filters.accountId) {
        return false;
      }

      // Date range filter
      if (filters.dateRange?.from) {
        const txnDate = parseISO(t.transaction_date);
        if (filters.dateRange.to) {
          if (!isWithinInterval(txnDate, { start: filters.dateRange.from, end: filters.dateRange.to })) {
            return false;
          }
        } else {
          if (txnDate < filters.dateRange.from) {
            return false;
          }
        }
      }

      return true;
    });
  }, [transactions, filters]);

  // Stats
  const stats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter(t => t.transaction_type === 'Credit')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpense = filteredTransactions
      .filter(t => t.transaction_type === 'Debit')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { totalIncome, totalExpense, count: filteredTransactions.length };
  }, [filteredTransactions]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {stats.count} transactions
            {stats.totalExpense > 0 && (
              <span> · <span className="text-foreground">₹{stats.totalExpense.toLocaleString('en-IN')}</span> spent</span>
            )}
            {stats.totalIncome > 0 && (
              <span> · <span className="text-income">₹{stats.totalIncome.toLocaleString('en-IN')}</span> earned</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {transactions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Transactions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{transactions.length}</strong> transactions. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllTransactions}
                    disabled={isDeletingAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingAll ? 'Deleting...' : 'Delete All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <CSVImportDialog 
            userId={user?.id || ''} 
            accounts={accounts} 
            categories={categories}
            subcategories={subcategories}
            onImportComplete={fetchData} 
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select
                      value={formData.transaction_type}
                      onValueChange={(value: TransactionType) => setFormData({ ...formData, transaction_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Debit">Expense (Debit)</SelectItem>
                        <SelectItem value="Credit">Income (Credit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account *</Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="What was this transaction for?"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Party</Label>
                    <Input
                      placeholder="Payee or payer name"
                      value={formData.party}
                      onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                    />
                  </div>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Transaction Mode</Label>
                    <Select
                      value={formData.transaction_mode}
                      onValueChange={(value: TransactionMode) => setFormData({ ...formData, transaction_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="NEFT">NEFT</SelectItem>
                        <SelectItem value="IMPS">IMPS</SelectItem>
                        <SelectItem value="RTGS">RTGS</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="BBPS">BBPS</SelectItem>
                        <SelectItem value="EMI">EMI</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transaction Nature</Label>
                    <Select
                      value={formData.transaction_nature}
                      onValueChange={(value: TransactionNature) => setFormData({ ...formData, transaction_nature: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select nature" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Charge">Charge</SelectItem>
                        <SelectItem value="Money Transfer">Money Transfer</SelectItem>
                        <SelectItem value="Auto Sweep">Auto Sweep</SelectItem>
                        <SelectItem value="Reversal">Reversal</SelectItem>
                        <SelectItem value="Rewards">Rewards</SelectItem>
                        <SelectItem value="System Charge">System Charge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tag</Label>
                    <Input
                      placeholder="e.g., vacation, work"
                      value={formData.tag}
                      onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Group</Label>
                    <Input
                      placeholder="e.g., Trip to Goa"
                      value={formData.group_name}
                      onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bank Remarks</Label>
                  <Input
                    placeholder="Bank statement remarks"
                    value={formData.bank_remarks}
                    onChange={(e) => setFormData({ ...formData, bank_remarks: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Transaction'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        accounts={accounts}
      />

      {/* Transaction List */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4 animate-pulse border-b border-border/40">
                <div className="w-9 h-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <TransactionList 
            transactions={filteredTransactions} 
            onTransactionClick={(txn) => setSelectedTransaction(txn)}
          />
        )}
      </div>

      {/* Transaction Detail Sheet */}
      <TransactionDetailSheet
        transaction={selectedTransaction}
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onUpdate={fetchData}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
