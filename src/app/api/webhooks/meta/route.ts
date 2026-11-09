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

        const attachments = messagingItem.message?.attachments || [];
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
        const textContent = messagingItem.message?.text || messagingItem.postback?.title || '';

        // Determine message preview text for last_message
        let previewText = textContent;
        if (!previewText && hasAttachments) {
          const firstType = attachments[0]?.type;
          if (firstType === 'image') previewText = '📷 [รูปภาพ]';
          else if (firstType === 'video') previewText = '🎥 [วิดีโอ]';
          else if (firstType === 'audio') previewText = '🎵 [ข้อความเสียง]';
          else previewText = '📎 [ไฟล์แนบ]';
        } else if (!previewText) {
          previewText = 'ข้อความใหม่';
        }

        // Fetch user profile from Graph API if token available
        let customerName = 'ลูกค้า Facebook';
        let customerAvatar: string | null = null;

        if (pageToken) {
          // Method 1: Query page conversation endpoint (works reliably without Advanced Access / App Review!)
          try {
            const convRes = await fetch(
              `https://graph.facebook.com/v21.0/${pageId}/conversations?user_id=${senderId}&fields=senders&access_token=${pageToken}`,
              { signal: AbortSignal.timeout(3500) }
            );
            if (convRes.ok) {
              const convData = await convRes.json();
              const senderObj = convData.data?.[0]?.senders?.data?.find(
                (s: any) => String(s.id) === String(senderId)
              );
              if (senderObj?.name && senderObj.name.trim()) {
                customerName = senderObj.name.trim();
              }
            }
          } catch (cErr) {
            console.warn('Could not fetch name via page conversation:', cErr);
          }

          // Method 2: Direct profile lookup fallback (works if user is tester/admin or has advanced access)
          if (customerName === 'ลูกค้า Facebook' || !customerAvatar) {
            try {
              const profileRes = await fetch(
                `https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,profile_pic&access_token=${pageToken}`,
                { signal: AbortSignal.timeout(2500) }
              );
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                if ((profileData.first_name || profileData.last_name) && customerName === 'ลูกค้า Facebook') {
                  customerName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
                }
                if (profileData.profile_pic) {
                  customerAvatar = profileData.profile_pic;
                }
              }
            } catch (pErr) {
              // Ignore direct profile lookup error
            }
          }
        }

        // Check if conversation exists
        let convId: string | null = null;
        const { data: existingConv } = await supabase
          .from('chat_conversations')
          .select('id, unread_count, customer_name, customer_avatar')
          .eq('platform', 'facebook')
          .eq('platform_user_id', senderId)
          .maybeSingle();

        if (existingConv) {
          convId = existingConv.id;
          const updatedName =
            customerName !== 'ลูกค้า Facebook'
              ? customerName
              : (existingConv.customer_name || 'ลูกค้า Facebook');

          await supabase
            .from('chat_conversations')
            .update({
              last_message: previewText,
              last_message_at: new Date().toISOString(),
              unread_count: (existingConv.unread_count || 0) + 1,
              status: 'active',
              brand: brandSlug,
              customer_name: updatedName,
              customer_avatar: customerAvatar || existingConv.customer_avatar || undefined,
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
              last_message: previewText,
              last_message_at: new Date().toISOString(),
              unread_count: 1,
              status: 'active',
            })
            .select('id')
            .single();

          convId = newConv?.id || null;
        }

        if (convId) {
          if (hasAttachments) {
            for (let i = 0; i < attachments.length; i++) {
              const att = attachments[i];
              const attType = att.type || 'file';
              const mediaUrl = att.payload?.url || null;

              let msgType = 'file';
              let msgContent = '📎 [ไฟล์แนบ]';

              if (attType === 'image') {
                msgType = 'image';
                msgContent = (i === 0 && textContent) ? textContent : '📷 [รูปภาพ]';
              } else if (attType === 'video') {
                msgType = 'video';
                msgContent = '🎥 [วิดีโอ]';
              } else if (attType === 'audio') {
                msgType = 'audio';
                msgContent = '🎵 [ข้อความเสียง]';
              } else {
                msgType = 'file';
                msgContent = att.payload?.title ? `📎 [ไฟล์: ${att.payload.title}]` : '📎 [ไฟล์แนบ]';
              }

              await supabase.from('chat_messages').insert({
                conversation_id: convId,
                sender_type: 'customer',
                sender_name: customerName,
                sender_avatar: customerAvatar,
                message_type: msgType,
                media_url: mediaUrl,
                content: msgContent,
                status: 'sent',
              });
            }
          } else {
            await supabase.from('chat_messages').insert({
              conversation_id: convId,
              sender_type: 'customer',
              sender_name: customerName,
              sender_avatar: customerAvatar,
              message_type: 'text',
              content: previewText,
              status: 'sent',
            });
          }
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err: any) {
    console.error('Meta Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}
