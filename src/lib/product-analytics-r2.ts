// src/lib/product-analytics-r2.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'wallcraft';
const R2_VIEWS_KEY = 'analytics/product_views.json';
const R2_LOGS_KEY = 'analytics/engagement_logs.json';

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export interface EngagementLogEvent {
  id: string;
  productId: number | string;
  productName: string;
  collection: string;
  variantPattern?: string;
  viewerType: 'sales' | 'customer';
  userId?: string;
  userEmail?: string;
  userName?: string;
  durationSeconds: number;
  isIdle: boolean;
  device?: string;
  timestamp: string; // ISO
}

export async function getEngagementLogsFromR2(): Promise<EngagementLogEvent[]> {
  const client = getR2Client();
  if (!client) return [];

  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: R2_LOGS_KEY,
      })
    );
    const body = await res.Body?.transformToString();
    if (body) {
      return JSON.parse(body);
    }
  } catch (err: any) {
    if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) {
      console.error('Failed to read engagement logs from R2 in admin:', err);
    }
  }
  return [];
}

export async function getProductViewsFromR2(): Promise<Record<string, number>> {
  const client = getR2Client();
  if (!client) return {};

  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: R2_VIEWS_KEY,
      })
    );
    const body = await res.Body?.transformToString();
    if (body) {
      return JSON.parse(body);
    }
  } catch (err: any) {
    if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) {
      console.error('Failed to read product views from R2 in admin:', err);
    }
  }
  return {};
}

export async function resetAnalyticsInR2(): Promise<void> {
  const client = getR2Client();
  if (!client) return;

  await Promise.all([
    client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: R2_VIEWS_KEY,
        Body: JSON.stringify({}),
        ContentType: 'application/json',
      })
    ),
    client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: R2_LOGS_KEY,
        Body: JSON.stringify([]),
        ContentType: 'application/json',
      })
    ),
  ]);
}
