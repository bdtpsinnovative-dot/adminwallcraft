import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VERIFY_TOKEN = 'wallcraft_omnichannel_secret';

const SINGAPORE_SUPABASE_URL = process.env.SINGAPORE_SUPABASE_URL || 'https://gshppxgvdrmbfcxsxeph.supabase.co';
const SINGAPORE_SUPABASE_ANON_KEY = process.env.SINGAPORE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHBweGd2ZHJtYmZjeHN4ZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjQzODAsImV4cCI6MjEwNzYwMDM4MH0.lhpLOeb7oY0e-ZCIgSBgzHfPAgAzK8eqFgUPg9te8XM';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta Webhook verified successfully!');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Verification failed', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.object !== 'page') {
      return new Response('Not a page event', { status: 404 });
    }

    const supabase = createClient(SINGAPORE_SUPABASE_URL, SINGAPORE_SUPABASE_ANON_KEY);

    for (const entry of body.entry || []) {
      const pageId = String(entry.id);

      // Find channel
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('platform', 'facebook')
        .eq('channel_id', pageId)
        .maybeSingle();

      const brandSlug = channel?.brand_slug || 'wallcraft';
      const pageToken = channel?.channel_access_token;

      for (const messagingItem of entry.messaging || []) {
        const senderId = messagingItem.sender?.id;
        if (!senderId || String(senderId) === pageId) continue;

        // Skip echo messages sent by the page itself
        if (messagingItem.message?.is_echo) continue;

        const messageText =
          messagingItem.message?.text ||
          messagingItem.postback?.title ||
          (messagingItem.message?.attachments ? 'ส่งไฟล์แนบ/รูปภาพ' : 'ข้อความใหม่');

        // Fetch user profile from Graph API if token available
        let customerName = 'ลูกค้า Facebook';
        let customerAvatar = null;

        if (pageToken) {
          try {
            const profileRes = await fetch(
              `https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,profile_pic&access_token=${pageToken}`,
              { signal: AbortSignal.timeout(3000) }
            );
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              if (profileData.first_name || profileData.last_name) {
                customerName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
              }
              if (profileData.profile_pic) {
                customerAvatar = profileData.profile_pic;
              }
            }
          } catch (pErr) {
            console.warn('Could not fetch FB profile:', pErr);
          }
        }

        // Check if conversation exists
        let convId: string | null = null;
        const { data: existingConv } = await supabase
          .from('chat_conversations')
          .select('id, unread_count')
          .eq('platform', 'facebook')
          .eq('platform_user_id', senderId)
          .maybeSingle();

        if (existingConv) {
          convId = existingConv.id;
          await supabase
            .from('chat_conversations')
            .update({
              last_message: messageText,
              last_message_at: new Date().toISOString(),
              unread_count: (existingConv.unread_count || 0) + 1,
              status: 'active',
              brand: brandSlug,
              customer_name: customerName !== 'ลูกค้า Facebook' ? customerName : undefined,
              customer_avatar: customerAvatar || undefined,
            })
            .eq('id', convId);
        } else {
          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({
              platform: 'facebook',
              platform_user_id: senderId,
              customer_name: customerName,
              customer_avatar: customerAvatar,
              brand: brandSlug,
              last_message: messageText,
              last_message_at: new Date().toISOString(),
              unread_count: 1,
              status: 'active',
            })
            .select('id')
            .single();

          convId = newConv?.id || null;
        }

        if (convId) {
          await supabase.from('chat_messages').insert({
            conversation_id: convId,
            sender_type: 'customer',
            sender_name: customerName,
            sender_avatar: customerAvatar,
            message_type: 'text',
            content: messageText,
            status: 'sent',
          });
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err: any) {
    console.error('Meta Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}
