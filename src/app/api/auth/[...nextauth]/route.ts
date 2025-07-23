import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'

const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'dex',
      name: 'Dex',
      type: 'oauth',
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      authorization: {
        url: process.env.OIDC_AUTHORIZATION_ENDPOINT,
        params: {
          scope: process.env.OIDC_SCOPE || 'openid profile email',
          response_type: 'code',
        },
      },
      token: process.env.OIDC_TOKEN_ENDPOINT,
      userinfo: process.env.OIDC_USERINFO_ENDPOINT,
      jwks_endpoint: process.env.OIDC_JWKS_URI,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }