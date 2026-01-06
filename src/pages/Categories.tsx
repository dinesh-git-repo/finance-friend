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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const colorOptions = [
  '#F97316', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444',
  '#10B981', '#6366F1', '#0EA5E9', '#22C55E', '#14B8A6',
  '#64748B', '#94A3B8', '#FBBF24', '#A855F7', '#F43F5E',
];

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: colorOptions[0] });

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_system.eq.true`)
        .order('is_system', { ascending: false })
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: formData.name,
          color: formData.color,
          is_system: false,
        });

      if (error) throw error;

      toast.success('Category added successfully');
      setIsDialogOpen(false);
      setFormData({ name: '', color: colorOptions[0] });
      fetchCategories();
    } catch (error: any) {
      console.error('Error adding category:', error);
      toast.error(error.message || 'Failed to add category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast.success('Category deleted');
      fetchCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const systemCategories = categories.filter(c => c.is_system);
  const userCategories = categories.filter(c => !c.is_system);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Categories</h1>
          <p className="text-muted-foreground">Organize your transactions by category</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input
                  placeholder="e.g., Subscriptions"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-8 h-8 rounded-full transition-transform",
                        formData.color === color && "ring-2 ring-offset-2 ring-primary scale-110"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Category'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Categories */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Default Categories</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {systemCategories.map((category) => (
                <Card key={category.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        System
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* User Categories */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Your Categories</h2>
            {userCategories.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-8 text-center">
                  <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    No custom categories yet. Add one to better organize your transactions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {userCategories.map((category) => (
                  <Card key={category.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
