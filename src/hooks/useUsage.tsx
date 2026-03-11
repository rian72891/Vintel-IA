import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getPlanLimits, PlanKey } from '@/lib/stripe';

export type UsageType = 'messages' | 'images' | 'files' | 'audio' | 'image_analyses';

interface UsageData {
  messages_used: number;
  images_used: number;
  files_used: number;
  audio_minutes_used: number;
  image_analyses_used: number;
  messages_reset_date: string;
  reset_date: string;
}

interface UsageContextType {
  usage: UsageData | null;
  loading: boolean;
  checkUsage: (type: UsageType) => boolean;
  incrementUsage: (type: UsageType, amount?: number) => Promise<void>;
  refreshUsage: () => Promise<void>;
  getUsagePercent: (type: UsageType) => number;
  getUsageLabel: (type: UsageType) => string;
}

const defaultUsage: UsageData = {
  messages_used: 0,
  images_used: 0,
  files_used: 0,
  audio_minutes_used: 0,
  image_analyses_used: 0,
  messages_reset_date: new Date().toISOString(),
  reset_date: new Date().toISOString(),
};

const UsageContext = createContext<UsageContextType>({
  usage: null,
  loading: true,
  checkUsage: () => true,
  incrementUsage: async () => {},
  refreshUsage: async () => {},
  getUsagePercent: () => 0,
  getUsageLabel: () => '',
});

export function UsageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUsage = useCallback(async () => {
    if (!user) {
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('usage_limits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Check if messages need daily reset
        const now = new Date();
        const messagesResetDate = new Date(data.messages_reset_date);
        const needsMessageReset = now.toDateString() !== messagesResetDate.toDateString();

        // Check if monthly counters need reset
        const resetDate = new Date(data.reset_date);
        const needsMonthlyReset = now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000;

        if (needsMessageReset || needsMonthlyReset) {
          const updates: any = { plan };
          if (needsMessageReset) {
            updates.messages_used = 0;
            updates.messages_reset_date = now.toISOString();
          }
          if (needsMonthlyReset) {
            updates.images_used = 0;
            updates.files_used = 0;
            updates.audio_minutes_used = 0;
            updates.image_analyses_used = 0;
            updates.reset_date = now.toISOString();
          }

          await supabase
            .from('usage_limits')
            .update(updates)
            .eq('user_id', user.id);

          setUsage({
            ...data,
            ...updates,
          });
        } else {
          setUsage(data);
        }
      } else {
        // Create usage record
        const now = new Date().toISOString();
        const { data: newData } = await supabase
          .from('usage_limits')
          .insert({
            user_id: user.id,
            plan,
            messages_used: 0,
            images_used: 0,
            files_used: 0,
            audio_minutes_used: 0,
            image_analyses_used: 0,
            messages_reset_date: now,
            reset_date: now,
          })
          .select()
          .single();

        if (newData) setUsage(newData);
      }
    } catch (e) {
      console.error('Error loading usage:', e);
    } finally {
      setLoading(false);
    }
  }, [user, plan]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const limits = getPlanLimits(plan);

  const checkUsage = useCallback((type: UsageType): boolean => {
    if (!usage) return true;
    switch (type) {
      case 'messages': return usage.messages_used < limits.messagesPerDay;
      case 'images': return usage.images_used < limits.imagesPerMonth;
      case 'files': return usage.files_used < limits.filesPerMonth;
      case 'audio': return usage.audio_minutes_used < limits.audioMinutesPerMonth;
      case 'image_analyses': return usage.image_analyses_used < limits.imageAnalysesPerMonth;
      default: return true;
    }
  }, [usage, limits]);

  const incrementUsage = useCallback(async (type: UsageType, amount = 1) => {
    if (!user || !usage) return;

    const fieldMap: Record<UsageType, string> = {
      messages: 'messages_used',
      images: 'images_used',
      files: 'files_used',
      audio: 'audio_minutes_used',
      image_analyses: 'image_analyses_used',
    };

    const field = fieldMap[type];
    const currentVal = (usage as any)[field] || 0;
    const newVal = currentVal + amount;

    await supabase
      .from('usage_limits')
      .update({ [field]: newVal })
      .eq('user_id', user.id);

    setUsage(prev => prev ? { ...prev, [field]: newVal } : prev);
  }, [user, usage]);

  const getUsagePercent = useCallback((type: UsageType): number => {
    if (!usage) return 0;
    const limitMap: Record<UsageType, number> = {
      messages: limits.messagesPerDay,
      images: limits.imagesPerMonth,
      files: limits.filesPerMonth,
      audio: limits.audioMinutesPerMonth,
      image_analyses: limits.imageAnalysesPerMonth,
    };
    const usageMap: Record<UsageType, number> = {
      messages: usage.messages_used,
      images: usage.images_used,
      files: usage.files_used,
      audio: usage.audio_minutes_used,
      image_analyses: usage.image_analyses_used,
    };
    const limit = limitMap[type];
    if (limit === Infinity) return 0;
    return Math.min((usageMap[type] / limit) * 100, 100);
  }, [usage, limits]);

  const getUsageLabel = useCallback((type: UsageType): string => {
    if (!usage) return '';
    const limitMap: Record<UsageType, number> = {
      messages: limits.messagesPerDay,
      images: limits.imagesPerMonth,
      files: limits.filesPerMonth,
      audio: limits.audioMinutesPerMonth,
      image_analyses: limits.imageAnalysesPerMonth,
    };
    const usageMap: Record<UsageType, number> = {
      messages: usage.messages_used,
      images: usage.images_used,
      files: usage.files_used,
      audio: usage.audio_minutes_used,
      image_analyses: usage.image_analyses_used,
    };
    const limit = limitMap[type];
    if (limit === Infinity) return `${usageMap[type]} / ∞`;
    return `${usageMap[type]} / ${limit}`;
  }, [usage, limits]);

  return (
    <UsageContext.Provider value={{ usage, loading, checkUsage, incrementUsage, refreshUsage, getUsagePercent, getUsageLabel }}>
      {children}
    </UsageContext.Provider>
  );
}

export const useUsage = () => useContext(UsageContext);
