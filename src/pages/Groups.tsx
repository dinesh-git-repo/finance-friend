import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, FolderOpen, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('transaction_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
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
        .from('transaction_groups')
        .insert({
          user_id: user.id,
          name: formData.name,
          description: formData.description || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        });

      if (error) throw error;

      toast.success('Group created successfully');
      setIsDialogOpen(false);
      setFormData({ name: '', description: '', start_date: '', end_date: '' });
      fetchGroups();
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast.error(error.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      const { error } = await supabase
        .from('transaction_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group deleted');
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error(error.message || 'Failed to delete group');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transaction Groups</h1>
          <p className="text-muted-foreground">Group related transactions together (e.g., "Goa Trip 2025")</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Transaction Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  placeholder="e.g., Goa Trip 2025"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Add notes about this group..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-border/50 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No groups yet. Create one to organize related transactions together.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="border-border/50 hover:border-border transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <h3 className="font-medium truncate">{group.name}</h3>
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {group.description}
                      </p>
                    )}
                    {(group.start_date || group.end_date) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {group.start_date && format(new Date(group.start_date), 'MMM d, yyyy')}
                        {group.start_date && group.end_date && ' - '}
                        {group.end_date && format(new Date(group.end_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(group.id)}
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
  );
}
