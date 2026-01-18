// hooks/useCategoryItems.ts (thay thế toàn bộ code cũ)
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useCategoryItems() {
  const [categories, setCategories] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchCategoryItems = async () => {
    setLoading(true);
    try {
      const { data: categoriesData, error: catError } = await supabase
        .from('cv_categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (catError) throw catError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('cv_items')
        .select('id, category_id, name, slug, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (itemsError) throw itemsError;

      const grouped: Record<string, any[]> = {};
      categoriesData?.forEach(cat => {
        grouped[cat.slug] = [];
      });
      itemsData?.forEach(item => {
        const category = categoriesData?.find(c => c.id === item.category_id);
        if (category && category.slug) {
          grouped[category.slug].push(item);
        }
      });
      setCategories(grouped);
    } catch (error) {
      console.error('Error fetching category items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryItems();

    // Realtime subscription để tự động refetch khi data thay đổi
    const channel = supabase.channel('category-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cv_categories' }, fetchCategoryItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cv_items' }, fetchCategoryItems)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { categories, loading, refetch: fetchCategoryItems };
}