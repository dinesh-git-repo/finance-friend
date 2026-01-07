import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Search, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import CSVImportDialog from '@/components/transactions/CSVImportDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
};

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const [transactionsRes, accountsRes, categoriesRes, subcategoriesRes, tagsRes, groupsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            *,
            accounts (name, account_type),
            categories (name, color)
          `)
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .limit(100),
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
        supabase
          .from('tags')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('transaction_groups')
          .select('*')
          .eq('user_id', user.id)
      ]);

      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (subcategoriesRes.data) setSubcategories(subcategoriesRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
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

    setIsSubmitting(true);

    try {
      const transactionData: any = {
        user_id: user.id,
        transaction_date: formData.transaction_date,
        day: format(new Date(formData.transaction_date), 'EEEE'),
        amount: parseFloat(formData.amount),
        transaction_type: formData.transaction_type,
        description: formData.description || null,
        party: formData.party || null,
        bank_remarks: formData.bank_remarks || null,
        account_id: formData.account_id || null,
        category_id: formData.category_id || null,
        transaction_mode: formData.transaction_mode || null,
        transaction_nature: formData.transaction_nature || null,
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

  const filteredTransactions = transactions.filter(t => {
    const query = searchQuery.toLowerCase();
    return (
      t.description?.toLowerCase().includes(query) ||
      t.party?.toLowerCase().includes(query) ||
      t.bank_remarks?.toLowerCase().includes(query) ||
      t.categories?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Manage and track all your transactions</p>
        </div>
        <div className="flex gap-2">
          <CSVImportDialog 
            userId={user?.id || ''} 
            accounts={accounts} 
            categories={categories}
            subcategories={subcategories}
            tags={tags}
            groups={groups}
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
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
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
                  <Label>Type</Label>
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
                  <Label>Account</Label>
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
                      <SelectItem value="Money Transfer">Money Transfer</SelectItem>
                      <SelectItem value="Auto Sweep">Auto Sweep</SelectItem>
                      <SelectItem value="System Charge">System Charge</SelectItem>
                      <SelectItem value="Charge">Charge</SelectItem>
                      <SelectItem value="Reversal">Reversal</SelectItem>
                      <SelectItem value="Rewards">Rewards</SelectItem>
                      <SelectItem value="Purchase">Purchase</SelectItem>
                      <SelectItem value="Income">Income</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? 'No transactions match your search' : 'No transactions yet. Add your first transaction to get started.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {format(new Date(transaction.transaction_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full",
                          transaction.transaction_type === 'Credit' 
                            ? "bg-income/10 text-income" 
                            : "bg-expense/10 text-expense"
                        )}>
                          {transaction.transaction_type === 'Credit' 
                            ? <ArrowDownLeft className="h-4 w-4" />
                            : <ArrowUpRight className="h-4 w-4" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {transaction.description || transaction.party || 'Transaction'}
                          </p>
                          {transaction.party && transaction.description && (
                            <p className="text-xs text-muted-foreground">{transaction.party}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.categories?.name && (
                        <Badge 
                          variant="secondary" 
                          className="font-normal"
                          style={{ 
                            backgroundColor: `${transaction.categories.color}20`,
                            color: transaction.categories.color 
                          }}
                        >
                          {transaction.categories.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.accounts?.name || '-'}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-medium",
                      transaction.transaction_type === 'Credit' ? "text-income" : "text-expense"
                    )}>
                      {transaction.transaction_type === 'Credit' ? '+' : '-'}
                      ₹{Number(transaction.amount).toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
