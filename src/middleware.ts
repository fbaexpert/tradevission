import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Check if the request is for the root path and has password reset parameters
  if (pathname === '/' && searchParams.has('mode') && searchParams.get('mode') === 'resetPassword' && searchParams.has('oobCode')) {
    const oobCode = searchParams.get('oobCode');
    
    // Construct the correct URL and redirect
    const url = request.nextUrl.clone();
    url.pathname = '/reset-password';
    url.search = `?mode=resetPassword&oobCode=${oobCode}`; // Keep original params
    
    return NextResponse.redirect(url);
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/',
}
