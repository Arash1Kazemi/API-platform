import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Quick gate: no session cookie -> go to the login page. The API still checks the cookie for real
// on every request, so this is only for a nicer experience, not the security boundary.
export function middleware(req: NextRequest) {
  if (!req.cookies.has('ap_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|login|_next|favicon.ico|icon.svg).*)'] };
