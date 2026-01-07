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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, ChevronDown, ChevronRight, ChevronLeft, Plus, Wallet, Tag, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TransactionType = Database['public']['Enums']['transaction_type'];
type TransactionMode = Database['public']['Enums']['transaction_mode'];
type TransactionNature = Database['public']['Enums']['transaction_nature'];
type AccountType = Database['public']['Enums']['account_type'];

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
  rowIndex: number; // CSV row number (1-indexed, after header)
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

interface NewEntity {
  name: string;
  type: 'account' | 'category' | 'tag' | 'group';
  selected: boolean;
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

const DEFAULT_ACCOUNT_TYPE: AccountType = 'Bank Account';

const VALID_TRANSACTION_TYPES: TransactionType[] = ['Debit', 'Credit'];
const VALID_MODES: TransactionMode[] = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'BBPS', 'EMI', 'Cash', 'Card', 'ACH', 'Other'];
const VALID_NATURES: TransactionNature[] = ['Money Transfer', 'Auto Sweep', 'System Charge', 'Charge', 'Reversal', 'Rewards', 'Purchase', 'Income', 'Other'];

const SAMPLE_CSV = `txnID,txnDate,txnDay,bankRemarks,amount,currency,txnType,accountID,accountType,relatedTxn,txnDescription,partyName,txnMode,txnNature,txnCategory,txnSubCategory,txnTag,txnGroup
,2024-01-15,Monday,UPI/123456789,1500.00,INR,Debit,HDFC Savings,Bank Account,,Grocery shopping,BigMart,UPI,Purchase,Food & Dining,,,
,2024-01-16,Tuesday,NEFT/SALARY/JAN,50000.00,INR,Credit,HDFC Savings,Bank Account,,Monthly salary,Acme Corp,NEFT,Income,Income,,,
,2024-01-17,Wednesday,AUTOPAY/NETFLIX,299.00,INR,Debit,ICICI Credit Card,Credit Card,,Netflix subscription,Netflix,Card,Purchase,Entertainment,,,`;

export default function CSVImportDialog({ 
  userId, 
  accounts: initialAccounts, 
  categories: initialCategories, 
  subcategories,
  tags: initialTags,
  groups: initialGroups,
  onImportComplete 
}: CSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [groups, setGroups] = useState(initialGroups);
  const [newEntities, setNewEntities] = useState<NewEntity[]>([]);
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

  // Split CSV content into rows, handling multi-line quoted fields
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
        // End of row (outside quotes)
        if (char === '\r' && content[i + 1] === '\n') {
          i++; // Skip the \n in \r\n
        }
        if (currentRow.trim()) {
          rows.push(currentRow);
        }
        currentRow = '';
      } else {
        currentRow += char;
      }
    }
    
    // Don't forget the last row
    if (currentRow.trim()) {
      rows.push(currentRow);
    }
    
    return rows;
  };

  const parseCSV = (content: string): ParsedTransaction[] => {
    const rows = splitCSVRows(content.trim());
    if (rows.length < 2) return [];

    // Auto-detect delimiter (tab or comma)
    const firstRow = rows[0];
    const delimiter = firstRow.includes('\t') ? '\t' : ',';

    // Parse and normalize headers using detected delimiter
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
      
      // Validate required fields
      if (!row.transaction_date) errors.push('Date is required');
      
      // Parse amount (handle comma-formatted numbers like "10,456.00")
      const amountStr = row.amount?.replace(/,/g, '') || '';
      const parsedAmount = parseFloat(amountStr);
      if (!amountStr || isNaN(parsedAmount)) errors.push('Valid amount is required');
      
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
        rowIndex: i + 1, // CSV row number (1-indexed, header is row 1)
        transaction_date: row.transaction_date,
        day: row.day || undefined,
        amount: parsedAmount || 0,
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

      // Detect new entities that don't exist
      const detected = detectNewEntities(parsed);
      setNewEntities(detected);

      const validCount = parsed.filter(t => t.isValid).length;
      const invalidCount = parsed.length - validCount;

      if (detected.length > 0) {
        toast.info(`Found ${detected.length} new items to create`);
      }

      if (invalidCount > 0) {
        toast.warning(`${validCount} valid, ${invalidCount} with errors`);
      } else {
        toast.success(`${validCount} transactions ready to import`);
      }
    };
    reader.readAsText(file);
  };

  const detectNewEntities = (transactions: ParsedTransaction[]): NewEntity[] => {
    const entities: NewEntity[] = [];
    const seen = new Set<string>();

    transactions.forEach(t => {
      // Check for new accounts
      if (t.account_name) {
        const key = `account:${t.account_name.toLowerCase()}`;
        if (!seen.has(key)) {
          const exists = accounts.some(a => a.name.toLowerCase() === t.account_name!.toLowerCase());
          if (!exists) {
            entities.push({ name: t.account_name, type: 'account', selected: true });
            seen.add(key);
          }
        }
      }

      // Check for new categories
      if (t.category_name) {
        const key = `category:${t.category_name.toLowerCase()}`;
        if (!seen.has(key)) {
          const exists = categories.some(c => c.name.toLowerCase() === t.category_name!.toLowerCase());
          if (!exists) {
            entities.push({ name: t.category_name, type: 'category', selected: true });
            seen.add(key);
          }
        }
      }

      // Check for new tags
      if (t.tag_name) {
        const key = `tag:${t.tag_name.toLowerCase()}`;
        if (!seen.has(key)) {
          const exists = tags.some(tg => tg.name.toLowerCase() === t.tag_name!.toLowerCase());
          if (!exists) {
            entities.push({ name: t.tag_name, type: 'tag', selected: true });
            seen.add(key);
          }
        }
      }

      // Check for new groups
      if (t.group_name) {
        const key = `group:${t.group_name.toLowerCase()}`;
        if (!seen.has(key)) {
          const exists = groups.some(g => g.name.toLowerCase() === t.group_name!.toLowerCase());
          if (!exists) {
            entities.push({ name: t.group_name, type: 'group', selected: true });
            seen.add(key);
          }
        }
      }
    });

    return entities;
  };

  const toggleEntity = (index: number) => {
    setNewEntities(prev => prev.map((e, i) => 
      i === index ? { ...e, selected: !e.selected } : e
    ));
  };

  const createNewEntities = async (): Promise<boolean> => {
    const selected = newEntities.filter(e => e.selected);
    if (selected.length === 0) return true;

    try {
      // Create accounts
      const newAccountsToCreate = selected.filter(e => e.type === 'account');
      if (newAccountsToCreate.length > 0) {
        const { data: createdAccounts, error } = await supabase
          .from('accounts')
          .insert(newAccountsToCreate.map(a => ({
            user_id: userId,
            name: a.name,
            account_type: DEFAULT_ACCOUNT_TYPE,
            balance: 0,
          })))
          .select('id, name');
        
        if (error) throw error;
        if (createdAccounts) {
          setAccounts(prev => [...prev, ...createdAccounts]);
        }
      }

      // Create categories
      const newCategoriesToCreate = selected.filter(e => e.type === 'category');
      if (newCategoriesToCreate.length > 0) {
        const { data: createdCategories, error } = await supabase
          .from('categories')
          .insert(newCategoriesToCreate.map(c => ({
            user_id: userId,
            name: c.name,
            is_system: false,
          })))
          .select('id, name');
        
        if (error) throw error;
        if (createdCategories) {
          setCategories(prev => [...prev, ...createdCategories]);
        }
      }

      // Create tags
      const newTagsToCreate = selected.filter(e => e.type === 'tag');
      if (newTagsToCreate.length > 0) {
        const { data: createdTags, error } = await supabase
          .from('tags')
          .insert(newTagsToCreate.map(t => ({
            user_id: userId,
            name: t.name,
          })))
          .select('id, name');
        
        if (error) throw error;
        if (createdTags) {
          setTags(prev => [...prev, ...createdTags]);
        }
      }

      // Create groups
      const newGroupsToCreate = selected.filter(e => e.type === 'group');
      if (newGroupsToCreate.length > 0) {
        const { data: createdGroups, error } = await supabase
          .from('transaction_groups')
          .insert(newGroupsToCreate.map(g => ({
            user_id: userId,
            name: g.name,
          })))
          .select('id, name');
        
        if (error) throw error;
        if (createdGroups) {
          setGroups(prev => [...prev, ...createdGroups]);
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error creating entities:', error);
      toast.error(`Failed to create items: ${error.message}`);
      return false;
    }
  };

  const handleImport = async () => {
    const validTransactions = parsedData.filter(t => t.isValid);
    if (validTransactions.length === 0) {
      toast.error('No valid transactions to import');
      return;
    }

    setIsImporting(true);

    try {
      // First, create any new entities that were selected
      const entitiesCreated = await createNewEntities();
      if (!entitiesCreated) {
        setIsImporting(false);
        return;
      }
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
      setNewEntities([]);
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

  // Aggregate errors with full transaction data
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

  // Helper to determine if a field has an error
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
                    {invalidCount} rows have issues. Click on an error to see affected rows:
                  </p>
                  <div className="space-y-1">
                    {sortedErrors.map(([error, { count, transactions: errorTxns }]) => {
                      const currentPage = getErrorPage(error);
                      const totalPages = Math.ceil(errorTxns.length / ROWS_PER_PAGE);
                      const startIdx = currentPage * ROWS_PER_PAGE;
                      const visibleTxns = errorTxns.slice(startIdx, startIdx + ROWS_PER_PAGE);
                      const errorField = getFieldError(error);
                      
                      return (
                        <Collapsible 
                          key={error} 
                          open={expandedError === error}
                          onOpenChange={(open) => {
                            setExpandedError(open ? error : null);
                            if (open) setErrorPage(error, 0);
                          }}
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
                            <div className="ml-6 mt-1 bg-background/30 rounded-md border border-border/50 overflow-hidden">
                              {/* Mini table showing error rows */}
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="py-2 px-3 w-14">Row</TableHead>
                                    <TableHead className={`py-2 px-3 ${errorField === 'date' ? 'bg-expense/10' : ''}`}>Date</TableHead>
                                    <TableHead className={`py-2 px-3 ${errorField === 'amount' ? 'bg-expense/10' : ''}`}>Amount</TableHead>
                                    <TableHead className={`py-2 px-3 ${errorField === 'type' ? 'bg-expense/10' : ''}`}>Type</TableHead>
                                    <TableHead className="py-2 px-3">Description</TableHead>
                                    <TableHead className={`py-2 px-3 ${errorField === 'mode' ? 'bg-expense/10' : ''}`}>Mode</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {visibleTxns.map((t) => (
                                    <TableRow key={t.rowIndex} className="text-xs">
                                      <TableCell className="py-1.5 px-3 font-mono text-muted-foreground">
                                        {t.rowIndex + 1}
                                      </TableCell>
                                      <TableCell className={`py-1.5 px-3 font-mono ${errorField === 'date' ? 'bg-expense/10 text-expense font-medium' : ''}`}>
                                        {t.transaction_date || <span className="text-expense italic">empty</span>}
                                      </TableCell>
                                      <TableCell className={`py-1.5 px-3 font-mono ${errorField === 'amount' ? 'bg-expense/10 text-expense font-medium' : ''}`}>
                                        {t.amount || <span className="text-expense italic">empty</span>}
                                      </TableCell>
                                      <TableCell className={`py-1.5 px-3 ${errorField === 'type' ? 'bg-expense/10 text-expense font-medium' : ''}`}>
                                        {t.transaction_type || <span className="text-expense italic">empty</span>}
                                      </TableCell>
                                      <TableCell className="py-1.5 px-3 max-w-[120px] truncate">
                                        {t.description || t.party || '-'}
                                      </TableCell>
                                      <TableCell className={`py-1.5 px-3 ${errorField === 'mode' ? 'bg-expense/10 text-expense font-medium' : ''}`}>
                                        {t.transaction_mode || '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              
                              {/* Pagination */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
                                  <span>
                                    Showing {startIdx + 1}-{Math.min(startIdx + ROWS_PER_PAGE, errorTxns.length)} of {errorTxns.length}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setErrorPage(error, Math.max(0, currentPage - 1));
                                      }}
                                      disabled={currentPage === 0}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="px-2">
                                      {currentPage + 1} / {totalPages}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setErrorPage(error, Math.min(totalPages - 1, currentPage + 1));
                                      }}
                                      disabled={currentPage >= totalPages - 1}
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
                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Tip: Fix these issues in your CSV file and re-upload. Valid rows ({validCount}) can still be imported.
                  </p>
                </div>
              )}

              {/* New Entities to Create */}
              {newEntities.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="h-5 w-5 text-primary" />
                    <h5 className="font-medium text-primary">New Items to Create</h5>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    These items from your CSV don't exist yet. Select which ones to create automatically:
                  </p>
                  <div className="grid gap-2">
                    {newEntities.map((entity, index) => {
                      const Icon = entity.type === 'account' ? Wallet : 
                                   entity.type === 'category' ? FolderOpen : 
                                   entity.type === 'tag' ? Tag : FolderOpen;
                      const typeLabel = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
                      
                      return (
                        <div 
                          key={`${entity.type}-${entity.name}`}
                          className="flex items-center gap-3 bg-background/50 hover:bg-background/80 rounded px-3 py-2 transition-colors cursor-pointer"
                          onClick={() => toggleEntity(index)}
                        >
                          <Checkbox 
                            checked={entity.selected} 
                            onCheckedChange={() => toggleEntity(index)}
                          />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{entity.name}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {typeLabel}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    ✨ Selected items will be created when you click Import.
                  </p>
                </div>
              )}

              <ScrollArea className="border rounded-lg">
                <div className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 sticky left-0 bg-background z-10">Status</TableHead>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="whitespace-nowrap">Day</TableHead>
                        <TableHead className="whitespace-nowrap">Amount</TableHead>
                        <TableHead className="whitespace-nowrap">Currency</TableHead>
                        <TableHead className="whitespace-nowrap">Type</TableHead>
                        <TableHead className="whitespace-nowrap">Account</TableHead>
                        <TableHead className="whitespace-nowrap">Description</TableHead>
                        <TableHead className="whitespace-nowrap">Party</TableHead>
                        <TableHead className="whitespace-nowrap">Bank Remarks</TableHead>
                        <TableHead className="whitespace-nowrap">Mode</TableHead>
                        <TableHead className="whitespace-nowrap">Nature</TableHead>
                        <TableHead className="whitespace-nowrap">Category</TableHead>
                        <TableHead className="whitespace-nowrap">Subcategory</TableHead>
                        <TableHead className="whitespace-nowrap">Tag</TableHead>
                        <TableHead className="whitespace-nowrap">Group</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 20).map((t, i) => (
                        <TableRow key={i} className={!t.isValid ? 'bg-expense/5' : ''}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            {t.isValid ? (
                              <CheckCircle2 className="h-4 w-4 text-income" />
                            ) : (
                              <div className="group relative">
                                <AlertCircle className="h-4 w-4 text-expense" />
                                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-20 w-48 p-2 bg-popover border rounded-md shadow-md text-xs">
                                  {t.errors.map((e, j) => (
                                    <p key={j} className="text-expense">{e}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{t.transaction_date || '-'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{t.day || '-'}</TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{t.currency || 'INR'}</TableCell>
                          <TableCell>
                            <Badge variant={t.transaction_type === 'Credit' ? 'default' : 'secondary'} className="whitespace-nowrap">
                              {t.transaction_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.account_name || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{t.description || '-'}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{t.party || '-'}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{t.bank_remarks || '-'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{t.transaction_mode || '-'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{t.transaction_nature || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.category_name || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.subcategory_name || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.tag_name || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.group_name || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
                {parsedData.length > 20 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    And {parsedData.length - 20} more transactions...
                  </div>
                )}
              </ScrollArea>
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
