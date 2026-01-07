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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type TransactionType = Database['public']['Enums']['transaction_type'];
type TransactionMode = Database['public']['Enums']['transaction_mode'];
type TransactionNature = Database['public']['Enums']['transaction_nature'];

interface CSVImportDialogProps {
  userId: string;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  onImportComplete: () => void;
}

interface ParsedTransaction {
  transaction_date: string;
  amount: number;
  transaction_type: TransactionType;
  description?: string;
  party?: string;
  bank_remarks?: string;
  account_name?: string;
  category_name?: string;
  transaction_mode?: TransactionMode;
  transaction_nature?: TransactionNature;
  isValid: boolean;
  errors: string[];
}

const VALID_TRANSACTION_TYPES: TransactionType[] = ['Debit', 'Credit'];
const VALID_MODES: TransactionMode[] = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'BBPS', 'EMI', 'Cash', 'Card', 'Other'];
const VALID_NATURES: TransactionNature[] = ['Money Transfer', 'Auto Sweep', 'System Charge', 'Charge', 'Reversal', 'Rewards', 'Purchase', 'Income', 'Other'];

const SAMPLE_CSV = `transaction_date,amount,transaction_type,description,party,bank_remarks,account_name,category_name,transaction_mode,transaction_nature
2024-01-15,1500.00,Debit,Grocery shopping,BigMart,UPI/123456789,HDFC Savings,Food & Dining,UPI,Purchase
2024-01-16,50000.00,Credit,Monthly salary,Acme Corp,NEFT/SALARY/JAN,HDFC Savings,Income,NEFT,Income
2024-01-17,299.00,Debit,Netflix subscription,Netflix,AUTOPAY/NETFLIX,ICICI Credit Card,Entertainment,Card,Purchase`;

export default function CSVImportDialog({ userId, accounts, categories, onImportComplete }: CSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (content: string): ParsedTransaction[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
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

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (row.transaction_date && !dateRegex.test(row.transaction_date)) {
        errors.push('Date must be YYYY-MM-DD format');
      }

      transactions.push({
        transaction_date: row.transaction_date,
        amount: parseFloat(row.amount) || 0,
        transaction_type: (row.transaction_type as TransactionType) || 'Debit',
        description: row.description || undefined,
        party: row.party || undefined,
        bank_remarks: row.bank_remarks || undefined,
        account_name: row.account_name || undefined,
        category_name: row.category_name || undefined,
        transaction_mode: row.transaction_mode as TransactionMode || undefined,
        transaction_nature: row.transaction_nature as TransactionNature || undefined,
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
        // Match account and category by name
        const account = accounts.find(a => 
          a.name.toLowerCase() === t.account_name?.toLowerCase()
        );
        const category = categories.find(c => 
          c.name.toLowerCase() === t.category_name?.toLowerCase()
        );

        return {
          user_id: userId,
          transaction_date: t.transaction_date,
          day: format(new Date(t.transaction_date), 'EEEE'),
          amount: t.amount,
          transaction_type: t.transaction_type,
          description: t.description || null,
          party: t.party || null,
          bank_remarks: t.bank_remarks || null,
          account_id: account?.id || null,
          category_id: category?.id || null,
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
                      <li><code className="text-xs bg-muted px-1 rounded">transaction_date</code> - Date in YYYY-MM-DD format (e.g., 2024-01-15)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">amount</code> - Numeric value (e.g., 1500.00)</li>
                      <li><code className="text-xs bg-muted px-1 rounded">transaction_type</code> - Either "Debit" or "Credit"</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Optional Columns:</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-muted px-1 rounded">description</code> - Transaction description</li>
                      <li><code className="text-xs bg-muted px-1 rounded">party</code> - Payee or payer name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">bank_remarks</code> - Bank statement remarks</li>
                      <li><code className="text-xs bg-muted px-1 rounded">account_name</code> - Must match an existing account name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">category_name</code> - Must match an existing category name</li>
                      <li><code className="text-xs bg-muted px-1 rounded">transaction_mode</code> - UPI, NEFT, IMPS, RTGS, Cheque, BBPS, EMI, Cash, Card, Other</li>
                      <li><code className="text-xs bg-muted px-1 rounded">transaction_nature</code> - Money Transfer, Auto Sweep, System Charge, Charge, Reversal, Rewards, Purchase, Income, Other</li>
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
