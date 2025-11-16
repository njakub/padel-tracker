import { randomUUID } from "crypto";

import NextAuth, { type NextAuthConfig } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const FALLBACK_SYSTEM_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

type SystemRole =
  (typeof FALLBACK_SYSTEM_ROLE)[keyof typeof FALLBACK_SYSTEM_ROLE];

const credentialsSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const bootstrapEmail = process.env.ADMIN_EMAIL;
const bootstrapPasswordHash = process.env.ADMIN_PASSWORD_HASH;

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          systemRole: user.systemRole ?? undefined,
        } satisfies {
          id: string;
          name: string;
          email: string;
          systemRole?: SystemRole;
        };
      }

      if (bootstrapEmail && bootstrapPasswordHash && email === bootstrapEmail) {
        const matchesBootstrap = await bcrypt.compare(
          password,
          bootstrapPasswordHash
        );

        if (!matchesBootstrap) {
          return null;
        }

        const bootstrapUser = await prisma.user.upsert({
          where: { email },
          update: {
            passwordHash: bootstrapPasswordHash,
            systemRole: FALLBACK_SYSTEM_ROLE.SUPER_ADMIN,
          },
          create: {
            email,
            name: "Super Administrator",
            passwordHash: bootstrapPasswordHash,
            systemRole: FALLBACK_SYSTEM_ROLE.SUPER_ADMIN,
          },
        });

        if (!bootstrapUser) {
          return null;
        }

        return {
          id: bootstrapUser.id,
          name: bootstrapUser.name ?? bootstrapUser.email,
          email: bootstrapUser.email,
          systemRole: bootstrapUser.systemRole ?? undefined,
        } satisfies {
          id: string;
          name: string;
          email: string;
          systemRole?: SystemRole;
        };
      }

      return null;
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // no-op handled below to keep backwards compatibility
}

const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;

if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

const config = {
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!account) {
        return true;
      }

      if (account.provider === "google") {
        const email = user.email;

        if (!email) {
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          const mutableUser = user as AdapterUser & {
            systemRole?: SystemRole;
          };
          mutableUser.id = existingUser.id;
          mutableUser.systemRole = existingUser.systemRole ?? undefined;

          if (!existingUser.name && user.name) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { name: user.name },
            });
          }

          return true;
        }

        const passwordHash = await bcrypt.hash(randomUUID(), 12);
        const createdUser = await prisma.user.create({
          data: {
            email,
            name: user.name,
            passwordHash,
          },
        });

        if (!createdUser) {
          return false;
        }

        const mutableUser = user as AdapterUser & {
          systemRole?: SystemRole;
        };
        mutableUser.id = createdUser.id;
        mutableUser.systemRole = createdUser.systemRole ?? undefined;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AdapterUser & {
          systemRole?: SystemRole;
        };
        token.systemRole = authUser.systemRole;
        token.sub = authUser.id;
      } else if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });

        if (dbUser) {
          token.systemRole = dbUser.systemRole ?? undefined;
          token.email = dbUser.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        session.user.systemRole = token.systemRole as SystemRole | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
