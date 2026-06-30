import {jsonMutation} from '@/lib/life-coach/server';
import {verifyWebhook} from '@clerk/nextjs/webhooks';
import {type NextRequest, NextResponse} from 'next/server';
import {jsonError} from '@/lib/life-coach/server';
import {upsertClerkUserFromWebhook} from '@/lib/auth/clerk-user';

export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return jsonError('Webhook not configured', 503);
  }

  let event;
  try {
    event = await verifyWebhook(request, {signingSecret: secret});
  } catch {
    return jsonError('Invalid webhook signature', 400);
  }

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const clerkId = event.data.id;
      const email =
        event.data.email_addresses?.find(
          (entry) => entry.id === event.data.primary_email_address_id
        )?.email_address ?? event.data.email_addresses?.[0]?.email_address;

      await upsertClerkUserFromWebhook({clerkId, email});
      break;
    }
    case 'user.deleted': {
      const clerkId = event.data.id;
      if (clerkId) {
        await upsertClerkUserFromWebhook({clerkId, deleted: true});
      }
      break;
    }
    default:
      break;
  }

  return jsonMutation();
}
