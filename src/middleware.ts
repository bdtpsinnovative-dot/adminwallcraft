// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  const pathname = request.nextUrl.pathname;

  // 🌟 กำหนดหน้าที่ "ไม่ต้องล็อกอินก็เข้าได้" (หน้าบ้าน และ หน้าล็อกอิน)
  const isPublicPage = pathname === '/' || pathname.startsWith('/login');
  const isApiRoute = pathname.startsWith('/api');

  // 1. ถ้าไม่มี Token และพยายามเข้าหน้าหลังบ้าน -> เตะไปหน้า Login
  if (!token && !isPublicPage && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. ถ้ามี Token (ล็อกอินแล้ว) แต่พยายามเข้าหน้า Login หรือหน้าบ้าน -> ดันไป Dashboard
  if (token && isPublicPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};