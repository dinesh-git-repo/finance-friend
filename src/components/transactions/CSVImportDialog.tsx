import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, ChevronDown, ChevronRight, ChevronLeft, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Use string literals since enums are being updated
type TransactionType = 'Debit' | 'Credit';
type TransactionMode = 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'Cheque' | 'BBPS' | 'EMI' | 'Cash' | 'Card' | 'ACH' | 'Other';
type TransactionNature = 'Charge' | 'Money Transfer' | 'Auto Sweep' | 'Reversal' | 'Rewards' | 'System Charge';
type AccountType = 'Bank Account' | 'Credit Card' | 'Cash' | 'Demat' | 'Loan' | 'Overdraft' | 'Wallet' | 'BNPL';

interface CSVImportDialogProps {
  userId: string;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
  onImportComplete: () => void;
}

interface ParsedTransaction {
  rowIndex: number;
  transaction_date: string;
  amount: number;
  currency?: string;
  transaction_type: TransactionType;
  description?: string;
  party?: string;
  bank_remarks?: string;
  account_name?: string;
  category_name?: string;
  subcategory_name?: string;
  tag?: string;
  group_name?: string;
  transaction_mode?: TransactionMode;
  transaction_nature?: TransactionNature;
  isValid: boolean;
  errors: string[];
}

interface UnmatchedAccount {
  name: string;
  count: number;
}

// Header mapping from user's CSV format to our internal format
const HEADER_MAP: Record<string, string> = {
  'txnid': 'txn_id',
  'txndate': 'transaction_date',
  'txnday': 'day',
  'bankremarks': 'bank_remarks',
  'amount': 'amount',
  'currency': 'currency',
  'txntype': 'transaction_type',
  'accountid': 'account_name',
  'accountname': 'account_name',
  'accounttype': 'account_type',
  'relatedtxn': 'related_txn',
  'txndescription': 'description',
  'partyname': 'party',
  'txnmode': 'transaction_mode',
  'txnnature': 'transaction_nature',
  'txncategory': 'category_name',
  'txnsubcategory': 'subcategory_name',
  'txntag': 'tag',
  'txngroup': 'group_name',
  'transaction_date': 'transaction_date',
  'transaction_type': 'transaction_type',
  'transaction_mode': 'transaction_mode',
  'transaction_nature': 'transaction_nature',
  'account_name': 'account_name',
  'category_name': 'category_name',
  'description': 'description',
  'party': 'party',
  'tag': 'tag',
  'group_name': 'group_name',
};



const VALID_TRANSACTION_TYPES: TransactionType[] = ['Debit', 'Credit'];
const VALID_MODES: TransactionMode[] = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'BBPS', 'EMI', 'Cash', 'Card', 'ACH', 'Other'];
const VALID_NATURES: TransactionNature[] = ['Charge', 'Money Transfer', 'Auto Sweep', 'Reversal', 'Rewards', 'System Charge'];

const SAMPLE_CSV = `txnID,txnDate,bankRemarks,amount,currency,txnType,accountID,txnDescription,partyName,txnMode,txnNature,txnCategory,txnTag,txnGroup
,2024-01-15,UPI/123456789,1500.00,INR,Debit,HDFC Savings,Grocery shopping,BigMart,UPI,Charge,Food & Dining,groceries,
,2024-01-16,NEFT/SALARY/JAN,50000.00,INR,Credit,HDFC Savings,Monthly salary,Acme Corp,NEFT,Money Transfer,Income,,
,2024-01-17,AUTOPAY/NETFLIX,299.00,INR,Debit,ICICI Credit Card,Netflix subscription,Netflix,Card,Charge,Entertainment,subscriptions,`;

export default function CSVImportDialog({ 
  userId, 
  accounts: initialAccounts, 
  categories: initialCategories, 
  subcategories,
  onImportComplete 
}: CSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unmatchedAccounts, setUnmatchedAccounts] = useState<UnmatchedAccount[]>([]);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [errorPages, setErrorPages] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ROWS_PER_PAGE = 5;

  const normalizeHeader = (header: string): string => {
    const normalized = header.toLowerCase().replace(/[\s_-]+/g, '');
    return HEADER_MAP[normalized] || normalized;
  };

  const splitCSVRows = (content: string): string[] => {
    const rows: string[] = [];
    let currentRow = '';
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        currentRow += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && content[i + 1] === '\n') {
          i++;
        }
        if (currentRow.trim()) {
          rows.push(currentRow);
        }
        currentRow = '';
      } else {
        currentRow += char;
      }
    }
    
    if (currentRow.trim()) {
      rows.push(currentRow);
    }
    
    return rows;
  };

  const parseCSV = (content: string): ParsedTransaction[] => {
    const rows = splitCSVRows(content.trim());
    if (rows.length < 2) return [];

    const firstRow = rows[0];
    const delimiter = firstRow.includes('\t') ? '\t' : ',';

    const rawHeaders = parseCSVLine(rows[0], delimiter);
    const headers = rawHeaders.map(h => normalizeHeader(h.trim()));
    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < rows.length; i++) {
      const values = parseCSVLine(rows[i], delimiter);
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      const errors: string[] = [];
      
      if (!row.transaction_date) errors.push('Date is required');
      
      const amountStr = row.amount?.replace(/,/g, '') || '';
      const parsedAmount = parseFloat(amountStr);
      if (!amountStr || isNaN(parsedAmount)) errors.push('Valid amount is required');
      
      if (!row.transaction_type || !VALID_TRANSACTION_TYPES.includes(row.transaction_type as TransactionType)) {
        errors.push('Type must be Debit or Credit');
      }

      if (row.transaction_mode && !VALID_MODES.includes(row.transaction_mode as TransactionMode)) {
        errors.push(`Invalid mode: ${row.transaction_mode}`);
      }
      if (row.transaction_nature && !VALID_NATURES.includes(row.transaction_nature as TransactionNature)) {
        errors.push(`Invalid nature: ${row.transaction_nature}`);
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (row.transaction_date && !dateRegex.test(row.transaction_date)) {
        errors.push('Date must be YYYY-MM-DD format');
      }

      transactions.push({
        rowIndex: i + 1,
        transaction_date: row.transaction_date,
        amount: parsedAmount || 0,
        currency: row.currency || undefined,
        transaction_type: (row.transaction_type as TransactionType) || 'Debit',
        description: row.description || undefined,
        party: row.party || undefined,
        bank_remarks: row.bank_remarks || undefined,
        account_name: row.account_name || undefined,
        category_name: row.category_name || undefined,
        subcategory_name: row.subcategory_name || undefined,
        tag: row.tag || undefined,
        group_name: row.group_name || undefined,
        transaction_mode: row.transaction_mode as TransactionMode || undefined,
        transaction_nature: row.transaction_nature as TransactionNature || undefined,
        isValid: errors.length === 0,
        errors,
      });
    }

    return transactions;
  };

  const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedData(parsed);

      // Detect unmatched accounts (for info only, won't create them)
      const unmatched = detectUnmatchedAccounts(parsed);
      setUnmatchedAccounts(unmatched);

      const validCount = parsed.filter(t => t.isValid).length;
      const invalidCount = parsed.length - validCount;

      if (unmatched.length > 0) {
        toast.warning(`${unmatched.length} account(s) not found - those transactions will have no account linked`);
      }

      if (invalidCount > 0) {
        toast.warning(`${validCount} valid, ${invalidCount} with errors`);
      } else {
        toast.success(`${validCount} transactions ready to import`);
      }
    };
    reader.readAsText(file);
  };

  const detectUnmatchedAccounts = (transactions: ParsedTransaction[]): UnmatchedAccount[] => {
    const unmatched: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.account_name) {
        const exists = initialAccounts.some(a => a.name.toLowerCase() === t.account_name!.toLowerCase());
        if (!exists) {
          const key = t.account_name.toLowerCase();
          unmatched[key] = (unmatched[key] || 0) + 1;
        }
      }
    });

    return Object.entries(unmatched).map(([name, count]) => ({ name, count }));
  };


  const handleImport = async () => {
    const validTransactions = parsedData.filter(t => t.isValid);
    if (validTransactions.length === 0) {
      toast.error('No valid transactions to import');
      return;
    }

    setIsImporting(true);

    try {
      const transactionsToInsert = validTransactions.map(t => {
        // Match account by name (case-insensitive)
        const account = initialAccounts.find(a => 
          a.name.toLowerCase() === t.account_name?.toLowerCase()
        );

        return {
          user_id: userId,
          transaction_date: t.transaction_date,
          amount: t.amount,
          currency: t.currency || 'INR',
          transaction_type: t.transaction_type,
          description: t.description || null,
          party: t.party || null,
          bank_remarks: t.bank_remarks || null,
          account_id: account?.id || null,
          // Store category and subcategory as plain text
          category_name: t.category_name || null,
          subcategory_name: t.subcategory_name || null,
          tag: t.tag || null,
          group_name: t.group_name || null,
          transaction_mode: t.transaction_mode || null,
          transaction_nature: t.transaction_nature || null,
        };
      });

      const { error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert as any);

      if (error) throw error;

      toast.success(`Successfully imported ${validTransactions.length} transactions`);
      setIsOpen(false);
      setParsedData([]);
      setFileName('');
      setUnmatchedAccounts([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImportComplete();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedData.filter(t => t.isValid).length;
  const invalidCount = parsedData.length - validCount;

  const errorDetails = useMemo(() => {
    const details: Record<string, { count: number; transactions: ParsedTransaction[] }> = {};
    parsedData.forEach((t) => {
      if (!t.isValid) {
        t.errors.forEach(error => {
          if (!details[error]) {
            details[error] = { count: 0, transactions: [] };
          }
          details[error].count += 1;
          details[error].transactions.push(t);
        });
      }
    });
    return details;
  }, [parsedData]);

  const sortedErrors = Object.entries(errorDetails)
    .sort((a, b) => b[1].count - a[1].count);

  const getErrorPage = (error: string) => errorPages[error] || 0;
  
  const setErrorPage = (error: string, page: number) => {
    setErrorPages(prev => ({ ...prev, [error]: page }));
  };

  const getFieldError = (error: string): string | null => {
    if (error.includes('Date')) return 'date';
    if (error.includes('amount')) return 'amount';
    if (error.includes('Type must be')) return 'type';
    if (error.includes('Invalid mode')) return 'mode';
    if (error.includes('Invalid nature')) return 'nature';
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your transactions. Make sure to follow the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Guide */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="format">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CSV Format Guide
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Required Columns:</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-muted px-1 rounded">txnDate</code> - Date in YYYY-MM-DD format</li>
                      <li><code className="text-xs bg-muted px-1 rounded">amount</code> - Numeric value</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnType</code> - Either "Debit" or "Credit"</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Optional Columns:</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-muted px-1 rounded">accountID</code> - Account name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnDescription</code> - Transaction description</li>
                      <li><code className="text-xs bg-muted px-1 rounded">partyName</code> - Payee or payer name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnMode</code> - UPI, NEFT, IMPS, RTGS, Cheque, BBPS, EMI, Cash, Card, ACH, Other</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnNature</code> - Charge, Money Transfer, Auto Sweep, Reversal, Rewards, System Charge</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnCategory</code> - Category name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnTag</code> - Tag text (freeform)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnGroup</code> - Group name text (freeform)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">bankRemarks</code> - Bank statement remarks</li>
                    </ul>
                  </div>

                  <Button variant="outline" size="sm" onClick={downloadSampleCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Sample CSV
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Select CSV File</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="flex-1"
              />
            </div>
            {fileName && (
              <p className="text-sm text-muted-foreground">
                Selected: {fileName}
              </p>
            )}
          </div>

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-income" />
                  <span className="text-sm">{validCount} valid</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm">{invalidCount} with errors</span>
                  </div>
                )}
              </div>

              {/* Unmatched Accounts Info */}
              {unmatchedAccounts.length > 0 && (
                <div className="border border-yellow-500/30 rounded-lg p-4 space-y-2 bg-yellow-500/5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-600">Unmatched Accounts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These account names don't match any existing accounts. Transactions will be imported without an account link:
                  </p>
                  <div className="space-y-1">
                    {unmatchedAccounts.map((acc, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        <span>{acc.name}</span>
                        <Badge variant="secondary" className="text-xs">{acc.count} txns</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {sortedErrors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">Errors Found:</h4>
                  {sortedErrors.map(([error, details]) => {
                    const isExpanded = expandedError === error;
                    const currentPage = getErrorPage(error);
                    const totalPages = Math.ceil(details.transactions.length / ROWS_PER_PAGE);
                    const startIndex = currentPage * ROWS_PER_PAGE;
                    const paginatedTransactions = details.transactions.slice(startIndex, startIndex + ROWS_PER_PAGE);
                    const errorField = getFieldError(error);
                    
                    return (
                      <Collapsible 
                        key={error} 
                        open={isExpanded}
                        onOpenChange={(open) => setExpandedError(open ? error : null)}
                      >
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm w-full p-2 rounded hover:bg-muted/50 transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-destructive">{error}</span>
                          <Badge variant="secondary" className="ml-auto">{details.count} rows</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-2">
                            <ScrollArea className="w-full">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-16">Row</TableHead>
                                    <TableHead className={errorField === 'date' ? 'text-destructive' : ''}>Date</TableHead>
                                    <TableHead className={errorField === 'amount' ? 'text-destructive' : ''}>Amount</TableHead>
                                    <TableHead className={errorField === 'type' ? 'text-destructive' : ''}>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className={errorField === 'mode' ? 'text-destructive' : ''}>Mode</TableHead>
                                    <TableHead className={errorField === 'nature' ? 'text-destructive' : ''}>Nature</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {paginatedTransactions.map((t) => (
                                    <TableRow key={t.rowIndex}>
                                      <TableCell className="font-mono text-xs">{t.rowIndex}</TableCell>
                                      <TableCell className={errorField === 'date' ? 'text-destructive font-medium' : ''}>
                                        {t.transaction_date || '-'}
                                      </TableCell>
                                      <TableCell className={errorField === 'amount' ? 'text-destructive font-medium' : ''}>
                                        {t.amount || '-'}
                                      </TableCell>
                                      <TableCell className={errorField === 'type' ? 'text-destructive font-medium' : ''}>
                                        {t.transaction_type || '-'}
                                      </TableCell>
                                      <TableCell className="max-w-[200px] truncate">
                                        {t.description || t.party || '-'}
                                      </TableCell>
                                      <TableCell className={errorField === 'mode' ? 'text-destructive font-medium' : ''}>
                                        {t.transaction_mode || '-'}
                                      </TableCell>
                                      <TableCell className={errorField === 'nature' ? 'text-destructive font-medium' : ''}>
                                        {t.transaction_nature || '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                <span className="text-xs text-muted-foreground">
                                  Showing {startIndex + 1}-{Math.min(startIndex + ROWS_PER_PAGE, details.transactions.length)} of {details.transactions.length}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={currentPage === 0}
                                    onClick={() => setErrorPage(error, currentPage - 1)}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-xs px-2">
                                    {currentPage + 1} / {totalPages}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={currentPage >= totalPages - 1}
                                    onClick={() => setErrorPage(error, currentPage + 1)}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}

              {/* Valid Transactions Preview */}
              {validCount > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Preview (first 5 valid):</h4>
                  <ScrollArea className="w-full border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Tag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData
                          .filter(t => t.isValid)
                          .slice(0, 5)
                          .map((t, i) => (
                            <TableRow key={i}>
                              <TableCell>{t.transaction_date}</TableCell>
                              <TableCell className={t.transaction_type === 'Debit' ? '' : 'text-income'}>
                                {t.transaction_type === 'Credit' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell>
                                <Badge variant={t.transaction_type === 'Credit' ? 'default' : 'secondary'}>
                                  {t.transaction_type}
                                </Badge>
                              </TableCell>
                              <TableCell>{t.account_name || '-'}</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {t.description || t.party || '-'}
                              </TableCell>
                              <TableCell>{t.category_name || '-'}</TableCell>
                              <TableCell>{t.tag || '-'}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || isImporting}
            >
              {isImporting ? 'Importing...' : `Import ${validCount} Transactions`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
