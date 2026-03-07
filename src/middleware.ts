import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import authConfig from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

// Define the routes that DO NOT require authentication
const publicRoutes = ['/login', '/register', '/api/auth'];

export default auth((req) => {
    const { nextUrl } = req;
    const isAuthenticated = !!req.auth;

    const isPublicRoute = publicRoutes.some(route => nextUrl.pathname.startsWith(route));

    // If user is trying to access a protected route without being authenticated
    if (!isAuthenticated && !isPublicRoute) {
        return NextResponse.redirect(new URL('/login', nextUrl));
    }

    // If user is authenticated but tries to go to login/register, redirect to dashboard or project join
    if (isAuthenticated && (nextUrl.pathname === '/login' || nextUrl.pathname === '/register')) {
        // Here we could add logic: if user has no active projects, redirect to /join-project
        // For now, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }

    return NextResponse.next();
});

// Configure which paths the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         */
        '/((?!_next/static|_next/image|assets|favicon.ico|sitemap.xml|robots.txt).*)',
    ],
};