import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'income' | 'expense';
}

export function StatCard({ title, value, icon, trend, variant = 'default' }: StatCardProps) {
  const trendIcon = trend ? (
    trend.value > 0 ? <TrendingUp className="h-3 w-3" /> :
    trend.value < 0 ? <TrendingDown className="h-3 w-3" /> :
    <Minus className="h-3 w-3" />
  ) : null;

  const trendColor = trend ? (
    trend.value > 0 ? 'text-income' :
    trend.value < 0 ? 'text-expense' :
    'text-muted-foreground'
  ) : '';

  return (
    <Card className="border-border/50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn(
              "text-2xl font-semibold font-mono",
              variant === 'income' && "text-income",
              variant === 'expense' && "text-expense"
            )}>
              {value}
            </p>
            {trend && (
              <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
                {trendIcon}
                <span>{Math.abs(trend.value)}%</span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            "p-2.5 rounded-lg",
            variant === 'default' && "bg-primary/10 text-primary",
            variant === 'income' && "bg-income/10 text-income",
            variant === 'expense' && "bg-expense/10 text-expense"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
