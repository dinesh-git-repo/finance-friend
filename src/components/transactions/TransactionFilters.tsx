import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Search, CalendarDays, SlidersHorizontal, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface FilterState {
  search: string;
  dateRange: DateRange | undefined;
  type: 'all' | 'Debit' | 'Credit';
  categoryId: string;
  accountId: string;
}

interface TransactionFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: { id: string; name: string; color?: string }[];
  accounts: { id: string; name: string }[];
}

export default function TransactionFilters({
  filters,
  onFiltersChange,
  categories,
  accounts,
}: TransactionFiltersProps) {
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const activeFilterCount = [
    filters.type !== 'all',
    filters.categoryId !== '',
    filters.accountId !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      type: 'all',
      categoryId: '',
      accountId: '',
    });
  };

  const clearDateRange = () => {
    onFiltersChange({
      ...filters,
      dateRange: undefined,
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9 bg-background"
        />
      </div>

      {/* Date Range */}
      <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            {filters.dateRange?.from ? (
              filters.dateRange.to ? (
                <span className="hidden sm:inline">
                  {format(filters.dateRange.from, 'MMM d')} - {format(filters.dateRange.to, 'MMM d')}
                </span>
              ) : (
                <span className="hidden sm:inline">{format(filters.dateRange.from, 'MMM d, yyyy')}</span>
              )
            ) : (
              <span className="hidden sm:inline">Date</span>
            )}
            {filters.dateRange?.from && (
              <X
                className="h-3 w-3 ml-1 hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  clearDateRange();
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={filters.dateRange?.from}
            selected={filters.dateRange}
            onSelect={(range) => {
              onFiltersChange({ ...filters, dateRange: range });
              if (range?.from && range?.to) {
                setIsDateOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Filters Popover */}
      <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filters</h4>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {/* Type Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Transaction Type</label>
              <Select
                value={filters.type}
                onValueChange={(value: 'all' | 'Debit' | 'Credit') =>
                  onFiltersChange({ ...filters, type: value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All transactions</SelectItem>
                  <SelectItem value="Debit">Expenses only</SelectItem>
                  <SelectItem value="Credit">Income only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={filters.categoryId || 'all'}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, categoryId: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Account</label>
              <Select
                value={filters.accountId || 'all'}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, accountId: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type { FilterState };
