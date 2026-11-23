// src/app/api/product-analytics/route.ts
import { NextResponse } from 'next/server';
import {
  getEngagementLogsFromR2,
  getProductViewsFromR2,
  resetAnalyticsInR2,
} from '@/lib/product-analytics-r2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'all';
    const viewerType = searchParams.get('viewerType') || 'all';
    const q = (searchParams.get('q') || '').toLowerCase().trim();

    const rawLogs = await getEngagementLogsFromR2();
    const viewsMap = await getProductViewsFromR2();

    const now = Date.now();
    let cutoffTime = 0;
    if (range === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoffTime = today.getTime();
    } else if (range === '7d') {
      cutoffTime = now - 7 * 86400 * 1000;
    } else if (range === '30d') {
      cutoffTime = now - 30 * 86400 * 1000;
    }

    // Filter logs
    const filteredLogs = rawLogs.filter((log) => {
      const logTime = new Date(log.timestamp).getTime();
      if (cutoffTime > 0 && logTime < cutoffTime) return false;
      if (viewerType !== 'all' && log.viewerType !== viewerType) return false;
      if (q) {
        const matchName = (log.productName || '').toLowerCase().includes(q);
        const matchUser = (log.userName || '').toLowerCase().includes(q);
        const matchCol = (log.collection || '').toLowerCase().includes(q);
        const matchEmail = (log.userEmail || '').toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchCol && !matchEmail) return false;
      }
      return true;
    });

    let totalViews = 0;
    let totalDuration = 0;
    let salesViews = 0;
    let customerViews = 0;
    let idleCount = 0;

    const productMap = new Map<string, {
      productId: number | string;
      productName: string;
      collection: string;
      views: number;
      salesViews: number;
      customerViews: number;
      totalDurationSeconds: number;
      idleCount: number;
    }>();

    const salesMap = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      views: number;
      totalDurationSeconds: number;
      idleCount: number;
      productCounts: Record<string, number>;
      lastActive: string;
    }>();

    for (const log of filteredLogs) {
      totalViews++;
      totalDuration += log.durationSeconds || 0;
      if (log.isIdle) idleCount++;
      if (log.viewerType === 'sales') salesViews++;
      else customerViews++;

      // Aggregate Product
      const pKey = String(log.productId);
      if (!productMap.has(pKey)) {
        productMap.set(pKey, {
          productId: log.productId,
          productName: log.productName || 'ไม่ระบุชื่อ',
          collection: log.collection || 'ทั่วไป',
          views: 0,
          salesViews: 0,
          customerViews: 0,
          totalDurationSeconds: 0,
          idleCount: 0,
        });
      }
      const pStat = productMap.get(pKey)!;
      pStat.views++;
      pStat.totalDurationSeconds += log.durationSeconds || 0;
      if (log.isIdle) pStat.idleCount++;
      if (log.viewerType === 'sales') pStat.salesViews++;
      else pStat.customerViews++;

      // Aggregate Sales Rep
      if (log.viewerType === 'sales' && (log.userId || log.userEmail)) {
        const sKey = log.userId || log.userEmail || 'unknown';
        if (!salesMap.has(sKey)) {
          salesMap.set(sKey, {
            userId: log.userId || '',
            userName: log.userName || 'พนักงานขาย',
            userEmail: log.userEmail || '',
            views: 0,
            totalDurationSeconds: 0,
            idleCount: 0,
            productCounts: {},
            lastActive: log.timestamp,
          });
        }
        const sStat = salesMap.get(sKey)!;
        sStat.views++;
        sStat.totalDurationSeconds += log.durationSeconds || 0;
        if (log.isIdle) sStat.idleCount++;
        sStat.productCounts[log.productName] = (sStat.productCounts[log.productName] || 0) + 1;
        if (new Date(log.timestamp).getTime() > new Date(sStat.lastActive).getTime()) {
          sStat.lastActive = log.timestamp;
        }
      }
    }

    const topProducts = Array.from(productMap.values())
      .map((p) => ({
        ...p,
        avgDurationSeconds: p.views > 0 ? Math.round(p.totalDurationSeconds / p.views) : 0,
      }))
      .sort((a, b) => b.views - a.views);

    const salesLeaderboard = Array.from(salesMap.values())
      .map((s) => {
        let topProd = '-';
        let maxCount = 0;
        for (const [prod, count] of Object.entries(s.productCounts)) {
          if (count > maxCount) {
            maxCount = count;
            topProd = prod;
          }
        }
        return {
          userId: s.userId,
          userName: s.userName,
          userEmail: s.userEmail,
          views: s.views,
          totalDurationSeconds: s.totalDurationSeconds,
          avgDurationSeconds: s.views > 0 ? Math.round(s.totalDurationSeconds / s.views) : 0,
          idleCount: s.idleCount,
          topProduct: topProd,
          lastActive: s.lastActive,
        };
      })
      .sort((a, b) => b.views - a.views);

    return NextResponse.json({
      success: true,
      summary: {
        totalViews,
        totalDurationSeconds: totalDuration,
        avgDurationSeconds: totalViews > 0 ? Math.round(totalDuration / totalViews) : 0,
        salesViews,
        customerViews,
        idleCount,
        activeSalesReps: salesLeaderboard.length,
      },
      topProducts: topProducts.slice(0, 100),
      salesLeaderboard,
      recentLogs: filteredLogs.slice(0, 200),
    });
  } catch (error: any) {
    console.error('Admin Analytics API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await resetAnalyticsInR2();
    return NextResponse.json({
      success: true,
      message: 'ล้างข้อมูลสถิติใน R2 เรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
