import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type AccountType = 'Bank Account' | 'Credit Card' | 'Cash' | 'Demat' | 'Loan' | 'Overdraft' | 'Wallet' | 'BNPL';
type CardNetwork = 'Visa' | 'Mastercard' | 'Rupay' | 'Amex' | 'Diners' | 'Discover' | 'JCB' | 'Other';

interface AccountCSVImportDialogProps {
  userId: string;
  onImportComplete: () => void;
}

interface ParsedAccount {
  rowIndex: number;
  name: string;
  account_type: AccountType;
  opening_balance: number;
  currency: string;
  issuer_name?: string;
  account_number?: string;
  account_variant?: string;
  card_network?: CardNetwork;
  network_variant?: string;
  credit_limit?: number;
  statement_day?: number;
  repayment_day?: number;
  isValid: boolean;
  errors: string[];
}

const HEADER_MAP: Record<string, string> = {
  'name': 'name',
  'account_name': 'name',
  'accountname': 'name',
  'account_type': 'account_type',
  'accounttype': 'account_type',
  'type': 'account_type',
  'opening_balance': 'opening_balance',
  'openingbalance': 'opening_balance',
  'balance': 'opening_balance',
  'currency': 'currency',
  'issuer_name': 'issuer_name',
  'issuername': 'issuer_name',
  'issuer': 'issuer_name',
  'bank': 'issuer_name',
  'account_number': 'account_number',
  'accountnumber': 'account_number',
  'account_variant': 'account_variant',
  'accountvariant': 'account_variant',
  'variant': 'account_variant',
  'card_network': 'card_network',
  'cardnetwork': 'card_network',
  'network': 'card_network',
  'network_variant': 'network_variant',
  'networkvariant': 'network_variant',
  'credit_limit': 'credit_limit',
  'creditlimit': 'credit_limit',
  'limit': 'credit_limit',
  'statement_day': 'statement_day',
  'statementday': 'statement_day',
  'repayment_day': 'repayment_day',
  'repaymentday': 'repayment_day',
  'due_day': 'repayment_day',
  'dueday': 'repayment_day',
};

const VALID_ACCOUNT_TYPES: AccountType[] = ['Bank Account', 'Credit Card', 'Cash', 'Demat', 'Loan', 'Overdraft', 'Wallet', 'BNPL'];
const VALID_CARD_NETWORKS: CardNetwork[] = ['Visa', 'Mastercard', 'Rupay', 'Amex', 'Diners', 'Discover', 'JCB', 'Other'];

const SAMPLE_CSV = `name,account_type,opening_balance,currency,issuer_name,account_number,card_network,credit_limit,statement_day,repayment_day
HDFC Savings,Bank Account,50000,INR,HDFC Bank,1234,,,
ICICI Credit Card,Credit Card,0,INR,ICICI Bank,5678,Visa,200000,15,5
Paytm Wallet,Wallet,1500,INR,Paytm,,,,`;

export default function AccountCSVImportDialog({ userId, onImportComplete }: AccountCSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedAccount[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeHeader = (header: string): string => {
    const normalized = header.toLowerCase().replace(/[\s_-]+/g, '');
    return HEADER_MAP[normalized] || normalized;
  };

  const parseCSV = (content: string): ParsedAccount[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => normalizeHeader(h.trim()));
    const accounts: ParsedAccount[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const errors: string[] = [];

      // Validate required fields
      if (!row.name) {
        errors.push('Account name is required');
      }

      // Parse and validate account type
      let accountType: AccountType = 'Bank Account';
      if (row.account_type) {
        const normalizedType = row.account_type.toLowerCase().replace(/[\s_-]+/g, '');
        const typeMap: Record<string, AccountType> = {
          'bankaccount': 'Bank Account',
          'bank': 'Bank Account',
          'savings': 'Bank Account',
          'creditcard': 'Credit Card',
          'credit': 'Credit Card',
          'cash': 'Cash',
          'demat': 'Demat',
          'loan': 'Loan',
          'overdraft': 'Overdraft',
          'wallet': 'Wallet',
          'bnpl': 'BNPL',
          'buynowpaylater': 'BNPL',
        };
        accountType = typeMap[normalizedType] || 'Bank Account';
        if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
          errors.push(`Invalid account type: ${row.account_type}`);
        }
      }

      // Parse card network
      let cardNetwork: CardNetwork | undefined;
      if (row.card_network) {
        const normalizedNetwork = row.card_network.toLowerCase();
        const networkMap: Record<string, CardNetwork> = {
          'visa': 'Visa',
          'mastercard': 'Mastercard',
          'rupay': 'Rupay',
          'amex': 'Amex',
          'americanexpress': 'Amex',
          'diners': 'Diners',
          'dinersclub': 'Diners',
          'discover': 'Discover',
          'jcb': 'JCB',
          'other': 'Other',
        };
        cardNetwork = networkMap[normalizedNetwork];
      }

      const account: ParsedAccount = {
        rowIndex: i,
        name: row.name || '',
        account_type: accountType,
        opening_balance: parseFloat(row.opening_balance) || 0,
        currency: row.currency || 'INR',
        issuer_name: row.issuer_name || undefined,
        account_number: row.account_number || undefined,
        account_variant: row.account_variant || undefined,
        card_network: cardNetwork,
        network_variant: row.network_variant || undefined,
        credit_limit: row.credit_limit ? parseFloat(row.credit_limit) : undefined,
        statement_day: row.statement_day ? parseInt(row.statement_day) : undefined,
        repayment_day: row.repayment_day ? parseInt(row.repayment_day) : undefined,
        isValid: errors.length === 0,
        errors,
      };

      accounts.push(account);
    }

    return accounts;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validAccounts = parsedData.filter(a => a.isValid);
    if (validAccounts.length === 0) {
      toast.error('No valid accounts to import');
      return;
    }

    setIsImporting(true);

    try {
      const accountsToInsert = validAccounts.map(a => ({
        user_id: userId,
        name: a.name,
        account_type: a.account_type,
        opening_balance: a.opening_balance,
        closing_balance: a.opening_balance,
        currency: a.currency,
        issuer_name: a.issuer_name || null,
        account_number: a.account_number || null,
        account_variant: a.account_variant || null,
        card_network: a.card_network || null,
        network_variant: a.network_variant || null,
        credit_limit: a.credit_limit || null,
        statement_day: a.statement_day || null,
        repayment_day: a.repayment_day || null,
      }));

      const { error } = await supabase
        .from('accounts')
        .insert(accountsToInsert as any);

      if (error) throw error;

      toast.success(`Successfully imported ${validAccounts.length} accounts`);
      setIsOpen(false);
      setParsedData([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImportComplete();
    } catch (error: any) {
      console.error('Error importing accounts:', error);
      toast.error(error.message || 'Failed to import accounts');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_accounts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedData.filter(a => a.isValid).length;
  const invalidCount = parsedData.filter(a => !a.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Accounts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import accounts
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* File Upload */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="account-csv-upload"
              />
              <label
                htmlFor="account-csv-upload"
                className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {fileName || 'Click to select CSV file'}
                </span>
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="mr-2 h-4 w-4" />
              Sample CSV
            </Button>
          </div>

          {/* Preview */}
          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-income" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3 text-expense" />
                    {invalidCount} invalid
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Issuer</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((account) => (
                      <TableRow key={account.rowIndex}>
                        <TableCell className="font-mono text-xs">{account.rowIndex}</TableCell>
                        <TableCell className="font-medium">{account.name || '-'}</TableCell>
                        <TableCell>{account.account_type}</TableCell>
                        <TableCell className="text-right font-mono">
                          {account.currency} {account.opening_balance.toLocaleString()}
                        </TableCell>
                        <TableCell>{account.issuer_name || '-'}</TableCell>
                        <TableCell>
                          {account.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-income" />
                          ) : (
                            <span className="text-xs text-expense">{account.errors[0]}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || isImporting}
          >
            {isImporting ? 'Importing...' : `Import ${validCount} Accounts`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
