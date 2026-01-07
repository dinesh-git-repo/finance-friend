import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Wallet, Building2, CreditCard, PiggyBank, Smartphone, TrendingUp, Landmark, Trash2, Banknote, CircleDollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

// Use string literals since enums are being updated
type AccountType = 'Bank Account' | 'Credit Card' | 'Cash' | 'Demat' | 'Loan' | 'Overdraft' | 'Wallet' | 'BNPL';
type CardNetwork = 'Visa' | 'Mastercard' | 'Rupay' | 'Amex' | 'Diners' | 'Discover' | 'JCB' | 'Other';

const accountTypeOptions: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: 'Bank Account', label: 'Bank Account', icon: Building2 },
  { value: 'Credit Card', label: 'Credit Card', icon: CreditCard },
  { value: 'Cash', label: 'Cash', icon: Wallet },
  { value: 'Demat', label: 'Demat Account', icon: TrendingUp },
  { value: 'Loan', label: 'Loan', icon: Landmark },
  { value: 'Overdraft', label: 'Overdraft', icon: Banknote },
  { value: 'Wallet', label: 'Digital Wallet', icon: Smartphone },
  { value: 'BNPL', label: 'Buy Now Pay Later', icon: CircleDollarSign },
];

const cardNetworkOptions: { value: CardNetwork; label: string }[] = [
  { value: 'Visa', label: 'Visa' },
  { value: 'Mastercard', label: 'Mastercard' },
  { value: 'Rupay', label: 'RuPay' },
  { value: 'Amex', label: 'American Express' },
  { value: 'Diners', label: 'Diners Club' },
  { value: 'Discover', label: 'Discover' },
  { value: 'JCB', label: 'JCB' },
  { value: 'Other', label: 'Other' },
];

interface AccountFormData {
  account_name: string;
  account_type: AccountType;
  opening_balance: string;
  currency: string;
  issuer_name: string;
  account_number: string;
  account_variant: string;
  card_network: CardNetwork | '';
  network_variant: string;
  credit_limit: string;
  statement_day: string;
  repayment_day: string;
}

const initialFormData: AccountFormData = {
  account_name: '',
  account_type: 'Bank Account',
  opening_balance: '0',
  currency: 'INR',
  issuer_name: '',
  account_number: '',
  account_variant: '',
  card_network: '',
  network_variant: '',
  credit_limit: '',
  statement_day: '',
  repayment_day: '',
};

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AccountFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('account_name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const insertData: any = {
        user_id: user.id,
        account_name: formData.account_name,
        account_type: formData.account_type,
        opening_balance: parseFloat(formData.opening_balance) || 0,
        closing_balance: parseFloat(formData.opening_balance) || 0,
        currency: formData.currency,
        issuer_name: formData.issuer_name || null,
        account_number: formData.account_number || null,
        account_variant: formData.account_variant || null,
        card_network: formData.card_network || null,
        network_variant: formData.network_variant || null,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
        statement_day: formData.statement_day ? parseInt(formData.statement_day) : null,
        repayment_day: formData.repayment_day ? parseInt(formData.repayment_day) : null,
      };

      const { error } = await supabase.from('accounts').insert(insertData);

      if (error) throw error;

      toast.success('Account added successfully');
      setIsDialogOpen(false);
      setFormData(initialFormData);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error adding account:', error);
      toast.error(error.message || 'Failed to add account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Account deleted');
      fetchAccounts();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account');
    }
  };

  const getAccountIcon = (accountType: string) => {
    const option = accountTypeOptions.find(opt => opt.value === accountType);
    return option?.icon || Wallet;
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.closing_balance || 0), 0);
  const showCardFields = formData.account_type === 'Credit Card' || formData.account_type === 'BNPL';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
          <p className="text-muted-foreground">Manage your financial accounts</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Account Name *</Label>
                  <Input
                    placeholder="e.g., HDFC Savings"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Type *</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value: AccountType) => setFormData({ ...formData, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Issuer / Bank Name</Label>
                  <Input
                    placeholder="e.g., HDFC Bank"
                    value={formData.issuer_name}
                    onChange={(e) => setFormData({ ...formData, issuer_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Number (last 4)</Label>
                  <Input
                    placeholder="e.g., 1234"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product Variant</Label>
                  <Input
                    placeholder="e.g., Regalia, Platinum"
                    value={formData.account_variant}
                    onChange={(e) => setFormData({ ...formData, account_variant: e.target.value })}
                  />
                </div>
              </div>

              {showCardFields && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Card Network</Label>
                      <Select
                        value={formData.card_network}
                        onValueChange={(value: CardNetwork) => setFormData({ ...formData, card_network: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                        <SelectContent>
                          {cardNetworkOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Network Variant</Label>
                      <Input
                        placeholder="e.g., Signature, Infinite"
                        value={formData.network_variant}
                        onChange={(e) => setFormData({ ...formData, network_variant: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Credit Limit</Label>
                      <Input
                        type="number"
                        step="1"
                        placeholder="0"
                        value={formData.credit_limit}
                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Statement Day</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="1-31"
                        value={formData.statement_day}
                        onChange={(e) => setFormData({ ...formData, statement_day: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Due Day</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="1-31"
                        value={formData.repayment_day}
                        onChange={(e) => setFormData({ ...formData, repayment_day: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Opening Balance</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Card */}
      <Card className="border-border/50 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p className="text-3xl font-semibold font-mono mt-1">
                ₹{totalBalance.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-border/50 animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No accounts yet. Add your first account to start tracking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const Icon = getAccountIcon(account.account_type);
            const balance = account.closing_balance ?? account.opening_balance ?? 0;
            const isNegative = balance < 0;

            return (
              <Card key={account.id} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-medium">{account.account_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {account.issuer_name ? `${account.issuer_name} · ` : ''}{account.account_type}
                        </p>
                        <p className={cn(
                          "text-xl font-mono font-semibold mt-2",
                          isNegative ? "text-expense" : "text-foreground"
                        )}>
                          ₹{Math.abs(balance).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
