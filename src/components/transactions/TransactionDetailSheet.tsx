import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Pencil, Trash2, X, Save, CreditCard, Calendar, Tag, Building2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS } from './TransactionRow';
import type { Database } from '@/integrations/supabase/types';

type TransactionType = Database['public']['Enums']['transaction_type'];
type TransactionMode = Database['public']['Enums']['transaction_mode'];
type TransactionNature = Database['public']['Enums']['transaction_nature'];

interface Transaction {
  id: string;
  transaction_date: string;
  day?: string;
  amount: number;
  currency?: string;
  transaction_type: TransactionType;
  description?: string;
  party?: string;
  bank_remarks?: string;
  account_id?: string;
  category_id?: string;
  subcategory_id?: string;
  tag_id?: string;
  group_id?: string;
  transaction_mode?: TransactionMode;
  transaction_nature?: TransactionNature;
  categories?: { name: string; color?: string } | null;
  accounts?: { name: string; account_type?: string } | null;
}

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  categories: { id: string; name: string; color?: string }[];
  accounts: { id: string; name: string }[];
}

export default function TransactionDetailSheet({
  transaction,
  isOpen,
  onClose,
  onUpdate,
  categories,
  accounts,
}: TransactionDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<Partial<Transaction>>({});

  const startEditing = () => {
    if (transaction) {
      setFormData({
        transaction_date: transaction.transaction_date,
        amount: transaction.amount,
        transaction_type: transaction.transaction_type,
        description: transaction.description || '',
        party: transaction.party || '',
        bank_remarks: transaction.bank_remarks || '',
        account_id: transaction.account_id || '',
        category_id: transaction.category_id || '',
        transaction_mode: transaction.transaction_mode || undefined,
        transaction_nature: transaction.transaction_nature || undefined,
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setFormData({});
  };

  const handleSave = async () => {
    if (!transaction) return;
    setIsSaving(true);

    try {
      const updateData: any = {
        transaction_date: formData.transaction_date,
        day: formData.transaction_date ? format(parseISO(formData.transaction_date), 'EEEE') : null,
        amount: Number(formData.amount),
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
        .update(updateData)
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success('Transaction updated');
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error(error.message || 'Failed to update transaction');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success('Transaction deleted');
      onClose();
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!transaction) return null;

  const categoryName = transaction.categories?.name || 'Uncategorized';
  const categoryEmoji = CATEGORY_ICONS[categoryName] || CATEGORY_ICONS[transaction.transaction_nature || ''] || '📦';
  const displayName = transaction.party || transaction.description || 'Transaction';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl">
                {categoryEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg truncate">{displayName}</SheetTitle>
                <SheetDescription className="text-sm">
                  {format(parseISO(transaction.transaction_date), 'EEEE, MMMM d, yyyy')}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Amount */}
          <div className="mt-6 text-center">
            <p
              className={cn(
                'text-4xl font-bold font-mono',
                transaction.transaction_type === 'Credit' ? 'text-income' : 'text-foreground'
              )}
            >
              {transaction.transaction_type === 'Credit' ? '+' : '-'}₹
              {Number(transaction.amount).toLocaleString('en-IN')}
            </p>
            <Badge variant={transaction.transaction_type === 'Credit' ? 'default' : 'secondary'} className="mt-2">
              {transaction.transaction_type === 'Credit' ? 'Income' : 'Expense'}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {isEditing ? (
              /* Edit Form */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={formData.transaction_date || ''}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
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

                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Transaction description"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Party</Label>
                  <Input
                    value={formData.party || ''}
                    onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                    placeholder="Payee or payer"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Account</Label>
                  <Select
                    value={formData.account_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, account_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={formData.category_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mode</Label>
                    <Select
                      value={formData.transaction_mode || 'none'}
                      onValueChange={(value: TransactionMode | 'none') =>
                        setFormData({ ...formData, transaction_mode: value === 'none' ? undefined : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="NEFT">NEFT</SelectItem>
                        <SelectItem value="IMPS">IMPS</SelectItem>
                        <SelectItem value="RTGS">RTGS</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="BBPS">BBPS</SelectItem>
                        <SelectItem value="EMI">EMI</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="ACH">ACH</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nature</Label>
                    <Select
                      value={formData.transaction_nature || 'none'}
                      onValueChange={(value: TransactionNature | 'none') =>
                        setFormData({ ...formData, transaction_nature: value === 'none' ? undefined : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nature" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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

                <div className="space-y-1.5">
                  <Label className="text-xs">Bank Remarks</Label>
                  <Input
                    value={formData.bank_remarks || ''}
                    onChange={(e) => setFormData({ ...formData, bank_remarks: e.target.value })}
                    placeholder="Bank statement remarks"
                  />
                </div>
              </div>
            ) : (
              /* View Details */
              <div className="space-y-4">
                {/* Category */}
                <DetailRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Category"
                  value={
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: transaction.categories?.color ? `${transaction.categories.color}15` : undefined,
                        color: transaction.categories?.color || undefined,
                      }}
                    >
                      {categoryEmoji} {categoryName}
                    </Badge>
                  }
                />

                {/* Account */}
                {transaction.accounts?.name && (
                  <DetailRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Account"
                    value={transaction.accounts.name}
                  />
                )}

                {/* Description */}
                {transaction.description && (
                  <DetailRow icon={<Building2 className="h-4 w-4" />} label="Description" value={transaction.description} />
                )}

                {/* Party */}
                {transaction.party && (
                  <DetailRow icon={<Building2 className="h-4 w-4" />} label="Party" value={transaction.party} />
                )}

                {/* Mode & Nature */}
                {(transaction.transaction_mode || transaction.transaction_nature) && (
                  <div className="flex gap-4">
                    {transaction.transaction_mode && (
                      <DetailRow icon={null} label="Mode" value={transaction.transaction_mode} />
                    )}
                    {transaction.transaction_nature && (
                      <DetailRow icon={null} label="Nature" value={transaction.transaction_nature} />
                    )}
                  </div>
                )}

                {/* Bank Remarks */}
                {transaction.bank_remarks && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Bank Remarks</p>
                    <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{transaction.bank_remarks}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-background">
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={cancelEditing} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this transaction. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button className="flex-1" onClick={startEditing}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}
