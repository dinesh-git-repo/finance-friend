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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TransactionType = Database['public']['Enums']['transaction_type'];
type TransactionMode = Database['public']['Enums']['transaction_mode'];
type TransactionNature = Database['public']['Enums']['transaction_nature'];

interface CSVImportDialogProps {
  userId: string;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
  tags: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  onImportComplete: () => void;
}

interface ParsedTransaction {
  transaction_date: string;
  day?: string;
  amount: number;
  currency?: string;
  transaction_type: TransactionType;
  description?: string;
  party?: string;
  bank_remarks?: string;
  account_name?: string;
  category_name?: string;
  subcategory_name?: string;
  tag_name?: string;
  group_name?: string;
  transaction_mode?: TransactionMode;
  transaction_nature?: TransactionNature;
  related_txn?: string;
  isValid: boolean;
  errors: string[];
}

// Header mapping from user's CSV format to our internal format
const HEADER_MAP: Record<string, string> = {
  'txnid': 'txn_id', // ignored during import
  'txndate': 'transaction_date',
  'txnday': 'day',
  'bankremarks': 'bank_remarks',
  'amount': 'amount',
  'currency': 'currency',
  'txntype': 'transaction_type',
  'accountid': 'account_name', // will lookup by name
  'accounttype': 'account_type', // ignored
  'relatedtxn': 'related_txn',
  'txndescription': 'description',
  'partyname': 'party',
  'txnmode': 'transaction_mode',
  'txnnature': 'transaction_nature',
  'txncategory': 'category_name',
  'txnsubcategory': 'subcategory_name',
  'txntag': 'tag_name',
  'txngroup': 'group_name',
  // Also support snake_case headers for backward compatibility
  'transaction_date': 'transaction_date',
  'transaction_type': 'transaction_type',
  'transaction_mode': 'transaction_mode',
  'transaction_nature': 'transaction_nature',
  'account_name': 'account_name',
  'category_name': 'category_name',
  'description': 'description',
  'party': 'party',
};

const VALID_TRANSACTION_TYPES: TransactionType[] = ['Debit', 'Credit'];
const VALID_MODES: TransactionMode[] = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'BBPS', 'EMI', 'Cash', 'Card', 'ACH', 'Other'];
const VALID_NATURES: TransactionNature[] = ['Money Transfer', 'Auto Sweep', 'System Charge', 'Charge', 'Reversal', 'Rewards', 'Purchase', 'Income', 'Other'];

const SAMPLE_CSV = `txnID,txnDate,txnDay,bankRemarks,amount,currency,txnType,accountID,accountType,relatedTxn,txnDescription,partyName,txnMode,txnNature,txnCategory,txnSubCategory,txnTag,txnGroup
,2024-01-15,Monday,UPI/123456789,1500.00,INR,Debit,HDFC Savings,Bank Account,,Grocery shopping,BigMart,UPI,Purchase,Food & Dining,,,
,2024-01-16,Tuesday,NEFT/SALARY/JAN,50000.00,INR,Credit,HDFC Savings,Bank Account,,Monthly salary,Acme Corp,NEFT,Income,Income,,,
,2024-01-17,Wednesday,AUTOPAY/NETFLIX,299.00,INR,Debit,ICICI Credit Card,Credit Card,,Netflix subscription,Netflix,Card,Purchase,Entertainment,,,`;

export default function CSVImportDialog({ 
  userId, 
  accounts, 
  categories, 
  subcategories,
  tags,
  groups,
  onImportComplete 
}: CSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeHeader = (header: string): string => {
    const normalized = header.toLowerCase().replace(/[\s_-]+/g, '');
    return HEADER_MAP[normalized] || normalized;
  };

  const parseCSV = (content: string): ParsedTransaction[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse and normalize headers
    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => normalizeHeader(h.trim()));
    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      const errors: string[] = [];
      
      // Validate required fields
      if (!row.transaction_date) errors.push('Date is required');
      if (!row.amount || isNaN(parseFloat(row.amount))) errors.push('Valid amount is required');
      if (!row.transaction_type || !VALID_TRANSACTION_TYPES.includes(row.transaction_type as TransactionType)) {
        errors.push('Type must be Debit or Credit');
      }

      // Validate optional enums
      if (row.transaction_mode && !VALID_MODES.includes(row.transaction_mode as TransactionMode)) {
        errors.push(`Invalid mode: ${row.transaction_mode}`);
      }
      if (row.transaction_nature && !VALID_NATURES.includes(row.transaction_nature as TransactionNature)) {
        errors.push(`Invalid nature: ${row.transaction_nature}`);
      }

      // Validate date format (support multiple formats)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (row.transaction_date && !dateRegex.test(row.transaction_date)) {
        errors.push('Date must be YYYY-MM-DD format');
      }

      transactions.push({
        transaction_date: row.transaction_date,
        day: row.day || undefined,
        amount: parseFloat(row.amount) || 0,
        currency: row.currency || undefined,
        transaction_type: (row.transaction_type as TransactionType) || 'Debit',
        description: row.description || undefined,
        party: row.party || undefined,
        bank_remarks: row.bank_remarks || undefined,
        account_name: row.account_name || undefined,
        category_name: row.category_name || undefined,
        subcategory_name: row.subcategory_name || undefined,
        tag_name: row.tag_name || undefined,
        group_name: row.group_name || undefined,
        transaction_mode: row.transaction_mode as TransactionMode || undefined,
        transaction_nature: row.transaction_nature as TransactionNature || undefined,
        related_txn: row.related_txn || undefined,
        isValid: errors.length === 0,
        errors,
      });
    }

    return transactions;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
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

      const validCount = parsed.filter(t => t.isValid).length;
      const invalidCount = parsed.length - validCount;

      if (invalidCount > 0) {
        toast.warning(`${validCount} valid, ${invalidCount} with errors`);
      } else {
        toast.success(`${validCount} transactions ready to import`);
      }
    };
    reader.readAsText(file);
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
        // Lookup IDs by name (case-insensitive)
        const account = accounts.find(a => 
          a.name.toLowerCase() === t.account_name?.toLowerCase()
        );
        const category = categories.find(c => 
          c.name.toLowerCase() === t.category_name?.toLowerCase()
        );
        const subcategory = subcategories.find(s => 
          s.name.toLowerCase() === t.subcategory_name?.toLowerCase()
        );
        const tag = tags.find(tg => 
          tg.name.toLowerCase() === t.tag_name?.toLowerCase()
        );
        const group = groups.find(g => 
          g.name.toLowerCase() === t.group_name?.toLowerCase()
        );

        return {
          user_id: userId,
          transaction_date: t.transaction_date,
          day: t.day || null,
          amount: t.amount,
          currency: t.currency || 'INR',
          transaction_type: t.transaction_type,
          description: t.description || null,
          party: t.party || null,
          bank_remarks: t.bank_remarks || null,
          account_id: account?.id || null,
          category_id: category?.id || null,
          subcategory_id: subcategory?.id || null,
          tag_id: tag?.id || null,
          group_id: group?.id || null,
          transaction_mode: t.transaction_mode || null,
          transaction_nature: t.transaction_nature || null,
        };
      });

      const { error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (error) throw error;

      toast.success(`Successfully imported ${validTransactions.length} transactions`);
      setIsOpen(false);
      setParsedData([]);
      setFileName('');
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

  // Aggregate errors for summary with row numbers
  const errorDetails = useMemo(() => {
    const details: Record<string, { count: number; rows: number[] }> = {};
    parsedData.forEach((t, index) => {
      if (!t.isValid) {
        t.errors.forEach(error => {
          if (!details[error]) {
            details[error] = { count: 0, rows: [] };
          }
          details[error].count += 1;
          details[error].rows.push(index + 2); // +2 because: +1 for 0-index, +1 for header row
        });
      }
    });
    return details;
  }, [parsedData]);

  const sortedErrors = Object.entries(errorDetails)
    .sort((a, b) => b[1].count - a[1].count);

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
                      <li><code className="text-xs bg-muted px-1 rounded">txnDate</code> - Date in YYYY-MM-DD format (e.g., 2024-01-15)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">amount</code> - Numeric value (e.g., 1500.00)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnType</code> - Either "Debit" or "Credit"</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Optional Columns:</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-muted px-1 rounded">txnID</code> - Transaction ID (ignored, auto-generated)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnDay</code> - Day of week (e.g., Monday)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">bankRemarks</code> - Bank statement remarks</li>
                      <li><code className="text-xs bg-muted px-1 rounded">currency</code> - Currency code (default: INR)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">accountID</code> - Account name (must match existing)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">accountType</code> - Account type (ignored)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">relatedTxn</code> - Related transaction ID</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnDescription</code> - Transaction description</li>
                      <li><code className="text-xs bg-muted px-1 rounded">partyName</code> - Payee or payer name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnMode</code> - UPI, NEFT, IMPS, RTGS, Cheque, BBPS, EMI, Cash, Card, ACH, Other</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnNature</code> - Money Transfer, Auto Sweep, System Charge, Charge, Reversal, Rewards, Purchase, Income, Other</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnCategory</code> - Category name (must match existing)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnSubCategory</code> - Subcategory name (must match existing)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnTag</code> - Tag name (must match existing)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">txnGroup</code> - Group name (must match existing)</li>
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
              <div className="flex items-center gap-4">
                <h4 className="font-medium">Preview</h4>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-income/10 text-income">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {validCount} valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="secondary" className="bg-expense/10 text-expense">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      {invalidCount} errors
                    </Badge>
                  )}
                </div>
              </div>

              {/* Error Summary */}
              {sortedErrors.length > 0 && (
                <div className="bg-expense/5 border border-expense/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-expense" />
                    <h5 className="font-medium text-expense">Error Summary</h5>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {invalidCount} rows have issues. Click on an error to see affected row numbers:
                  </p>
                  <div className="space-y-1">
                    {sortedErrors.map(([error, { count, rows }]) => (
                      <Collapsible 
                        key={error} 
                        open={expandedError === error}
                        onOpenChange={(open) => setExpandedError(open ? error : null)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between text-sm bg-background/50 hover:bg-background/80 rounded px-3 py-2 transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                              {expandedError === error ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-foreground text-left">{error}</span>
                            </div>
                            <Badge variant="outline" className="text-expense border-expense/30 ml-2 shrink-0">
                              {count} rows
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 p-3 bg-background/30 rounded-md border border-border/50">
                            <p className="text-xs text-muted-foreground mb-2">
                              Row numbers in your CSV file (including header):
                            </p>
                            <ScrollArea className="max-h-24">
                              <div className="flex flex-wrap gap-1">
                                {rows.slice(0, 100).map((row) => (
                                  <Badge key={row} variant="secondary" className="text-xs font-mono">
                                    {row}
                                  </Badge>
                                ))}
                                {rows.length > 100 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{rows.length - 100} more
                                  </Badge>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Tip: Fix these issues in your CSV file and re-upload. Valid rows ({validCount}) can still be imported.
                  </p>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 10).map((t, i) => (
                      <TableRow key={i} className={!t.isValid ? 'bg-expense/5' : ''}>
                        <TableCell>
                          {t.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-income" />
                          ) : (
                            <div className="group relative">
                              <AlertCircle className="h-4 w-4 text-expense" />
                              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-10 w-48 p-2 bg-popover border rounded-md shadow-md text-xs">
                                {t.errors.map((e, j) => (
                                  <p key={j} className="text-expense">{e}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.transaction_date}</TableCell>
                        <TableCell className="font-mono">{t.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={t.transaction_type === 'Credit' ? 'default' : 'secondary'}>
                            {t.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{t.description || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.account_name || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.category_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    And {parsedData.length - 10} more transactions...
                  </div>
                )}
              </div>
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
