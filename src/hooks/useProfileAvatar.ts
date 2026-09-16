import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const AVATAR_BUCKET = 'avatars';
const AVATAR_EVENT = 'vintel-profile-avatar-updated';

type AvatarEvent = CustomEvent<{ userId: string; avatarUrl: string | null }>;

function getGoogleAvatar(user: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const value = metadata?.avatar_url || metadata?.picture;
  return typeof value === 'string' && value ? value : null;
}

async function compressAvatar(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Escolha uma imagem JPG ou PNG.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 8 MB.');
  }

  const bitmap = await createImageBitmap(file);
  const size = Math.min(256, bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
  if (!blob) throw new Error('Não foi possível comprimir a imagem.');
  return new File([blob], 'avatar.webp', { type: 'image/webp' });
}

export function useProfileAvatar(user: User | null) {
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleAvatarUrl = useMemo(() => getGoogleAvatar(user), [user]);

  const refresh = useCallback(async () => {
    if (!user) {
      setCustomAvatarUrl(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    setCustomAvatarUrl(typeof data?.avatar_url === 'string' && data.avatar_url ? data.avatar_url : null);
  }, [user]);

  useEffect(() => {
    void refresh();
    const handleUpdate = (event: Event) => {
      const detail = (event as AvatarEvent).detail;
      if (detail?.userId === user?.id) setCustomAvatarUrl(detail.avatarUrl);
    };
    window.addEventListener(AVATAR_EVENT, handleUpdate);
    return () => window.removeEventListener(AVATAR_EVENT, handleUpdate);
  }, [refresh, user?.id]);

  const notify = useCallback((avatarUrl: string | null) => {
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId: user?.id, avatarUrl } }));
  }, [user?.id]);

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) throw new Error('Faça login para alterar sua foto.');
    setLoading(true);
    try {
      const compressed = await compressAvatar(file);
      const path = `${user.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, compressed, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
        avatar_url: avatarUrl,
      }, { onConflict: 'id' });
      if (profileError) throw profileError;

      setCustomAvatarUrl(avatarUrl);
      notify(avatarUrl);
      return avatarUrl;
    } finally {
      setLoading(false);
    }
  }, [notify, user]);

  const removeAvatar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const path = `${user.id}/avatar.webp`;
      const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      if (removeError && !removeError.message.toLowerCase().includes('not found')) throw removeError;
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      if (error) throw error;
      setCustomAvatarUrl(null);
      notify(null);
    } finally {
      setLoading(false);
    }
  }, [notify, user]);

  return {
    avatarUrl: customAvatarUrl || googleAvatarUrl,
    customAvatarUrl,
    googleAvatarUrl,
    loading,
    refresh,
    uploadAvatar,
    removeAvatar,
  };
}
