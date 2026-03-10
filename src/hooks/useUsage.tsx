import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PLANS, PlanKey, getPlanByName } from '@/lib/plans';

export type UsageType = 'messages' | 'images' | 'files' | 'audio' | 'image_analyses';

interface UsageData {
  messagesUsed: number;
  imagesUsed: number;
  filesUsed: number;
  audioMinutesUsed: number;
  imageAnalysesUsed: number;
}

interface UsageContextType {
  usage: UsageData;
  plan: PlanKey;
  subscriptionStatus: 'none' | 'active' | 'cancelled' | 'expired';
  loading: boolean;
  checkUsage: (type: UsageType) => { allowed: boolean; used: number; limit: number; remaining: number };
  incrementUsage: (type: UsageType, amount?: number) => Promise<boolean>;
  refreshUsage: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const UsageContext = createContext<UsageContextType>({
  usage: { messagesUsed: 0, imagesUsed: 0, filesUsed: 0, audioMinutesUsed: 0, imageAnalysesUsed: 0 },
  plan: 'free',
  subscriptionStatus: 'none',
  loading: true,
  checkUsage: () => ({ allowed: true, used: 0, limit: 0, remaining: 0 }),
  incrementUsage: async () => true,
  refreshUsage: async () => {},
  refreshSubscription: async () => {},
});

export function UsageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData>({
    messagesUsed: 0, imagesUsed: 0, filesUsed: 0, audioMinutesUsed: 0, imageAnalysesUsed: 0,
  });
  const [plan, setPlan] = useState<PlanKey>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'none' | 'active' | 'cancelled' | 'expired'>('none');
  const [loading, setLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    if (!user) { setPlan('free'); setSubscriptionStatus('none'); return; }

    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data && data.status === 'active') {
      setPlan(getPlanByName(data.plan));
      setSubscriptionStatus('active');
    } else if (data) {
      setPlan('free');
      setSubscriptionStatus(data.status as any);
    } else {
      setPlan('free');
      setSubscriptionStatus('none');
    }
  }, [user]);

  const refreshUsage = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      // Check if daily reset needed (messages)
      const now = new Date();
      const messagesResetDate = new Date(data.messages_reset_date);
      const needsDailyReset = now.toDateString() !== messagesResetDate.toDateString();

      // Check if monthly reset needed
      const resetDate = new Date(data.reset_date);
      const needsMonthlyReset = now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000;

      if (needsDailyReset || needsMonthlyReset) {
        const updates: any = {};
        if (needsDailyReset) {
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
        await supabase.from('usage_limits').update(updates).eq('user_id', user.id);
        
        setUsage({
          messagesUsed: needsDailyReset ? 0 : data.messages_used,
          imagesUsed: needsMonthlyReset ? 0 : data.images_used,
          filesUsed: needsMonthlyReset ? 0 : data.files_used,
          audioMinutesUsed: needsMonthlyReset ? 0 : data.audio_minutes_used,
          imageAnalysesUsed: needsMonthlyReset ? 0 : data.image_analyses_used,
        });
      } else {
        setUsage({
          messagesUsed: data.messages_used,
          imagesUsed: data.images_used,
          filesUsed: data.files_used,
          audioMinutesUsed: data.audio_minutes_used,
          imageAnalysesUsed: data.image_analyses_used,
        });
      }
    } else {
      // Create initial usage record
      await supabase.from('usage_limits').insert({
        user_id: user.id,
        plan: 'free',
      } as any);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      Promise.all([refreshSubscription(), refreshUsage()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, refreshSubscription, refreshUsage]);

  const checkUsage = useCallback((type: UsageType) => {
    const limits = PLANS[plan].limits;
    let used = 0;
    let limit = 0;

    switch (type) {
      case 'messages':
        used = usage.messagesUsed;
        limit = limits.messagesPerDay;
        break;
      case 'images':
        used = usage.imagesUsed;
        limit = limits.imagesPerMonth;
        break;
      case 'files':
        used = usage.filesUsed;
        limit = limits.filesPerMonth;
        break;
      case 'audio':
        used = usage.audioMinutesUsed;
        limit = limits.audioMinutesPerMonth;
        break;
      case 'image_analyses':
        used = usage.imageAnalysesUsed;
        limit = limits.imageAnalysesPerMonth;
        break;
    }

    return {
      allowed: limit === Infinity || used < limit,
      used,
      limit,
      remaining: limit === Infinity ? Infinity : Math.max(0, limit - used),
    };
  }, [plan, usage]);

  const incrementUsage = useCallback(async (type: UsageType, amount = 1) => {
    if (!user) return false;
    const check = checkUsage(type);
    if (!check.allowed) return false;

    const columnMap: Record<UsageType, string> = {
      messages: 'messages_used',
      images: 'images_used',
      files: 'files_used',
      audio: 'audio_minutes_used',
      image_analyses: 'image_analyses_used',
    };

    const col = columnMap[type];
    const currentVal = {
      messages: usage.messagesUsed,
      images: usage.imagesUsed,
      files: usage.filesUsed,
      audio: usage.audioMinutesUsed,
      image_analyses: usage.imageAnalysesUsed,
    }[type];

    await supabase
      .from('usage_limits')
      .update({ [col]: currentVal + amount } as any)
      .eq('user_id', user.id);

    // Update local state
    setUsage(prev => {
      const stateMap: Record<UsageType, keyof UsageData> = {
        messages: 'messagesUsed',
        images: 'imagesUsed',
        files: 'filesUsed',
        audio: 'audioMinutesUsed',
        image_analyses: 'imageAnalysesUsed',
      };
      return { ...prev, [stateMap[type]]: (prev[stateMap[type]] as number) + amount };
    });

    return true;
  }, [user, usage, checkUsage]);

  return (
    <UsageContext.Provider value={{ usage, plan, subscriptionStatus, loading, checkUsage, incrementUsage, refreshUsage, refreshSubscription }}>
      {children}
    </UsageContext.Provider>
  );
}

export const useUsage = () => useContext(UsageContext);
