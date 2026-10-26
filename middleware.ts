import { NextResponse, type NextRequest } from "next/server";
import { isLocale, pickLocale } from "./lib/i18n";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();
  const locale = pickLocale(req.headers.get("accept-language"));
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/((?!api|go|_next|sitemap\\.xml|robots\\.txt|favicon\\.ico|.*\\..*).*)"],
};
