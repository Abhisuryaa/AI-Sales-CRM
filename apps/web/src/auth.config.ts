import NextAuth from "next-auth";


import type { NextAuthConfig } from "next-auth";

export const publicPaths = [
  "/login",
  "/api/auth",
  "/api/webhooks/ingest",
  "/_next",
  "/favicon.ico",
  "/images",
];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isPublic = publicPaths.some(
        (p) =>
          pathname === p ||
          pathname.startsWith(`${p}/`) ||
          pathname === `${p}/` ||
          (p === "/api/auth" && pathname.startsWith("/api/auth/")),
      );
      const isStaticAsset =
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(pathname);
      if (isPublic || isStaticAsset) return true;
      return !!auth;
    },
  },
} satisfies NextAuthConfig;

