import { AdminRole } from "@prisma/client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const bootstrapEmail = process.env.ADMIN_EMAIL;
const bootstrapPasswordHash = process.env.ADMIN_PASSWORD_HASH;

type AuthRole = AdminRole;

const config = {
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
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
        const admin = await prisma.adminUser.findUnique({
          where: { email },
          include: { seasons: { select: { seasonId: true } } },
        });

        if (admin) {
          const isValid = await bcrypt.compare(password, admin.passwordHash);
          if (!isValid) {
            return null;
          }

          const adminSeasonIds = admin.seasons.map((season) => season.seasonId);

          return {
            id: admin.id,
            name: admin.name ?? admin.email,
            email: admin.email,
            role: admin.role,
            adminSeasonIds,
          } satisfies {
            id: string;
            name: string;
            email: string;
            role: AuthRole;
            adminSeasonIds: string[];
          };
        }

        if (
          bootstrapEmail &&
          bootstrapPasswordHash &&
          email === bootstrapEmail
        ) {
          const matchesBootstrap = await bcrypt.compare(
            password,
            bootstrapPasswordHash
          );

          if (!matchesBootstrap) {
            return null;
          }

          const bootstrapAdmin = await prisma.adminUser.upsert({
            where: { email },
            update: {
              passwordHash: bootstrapPasswordHash,
              role: AdminRole.SUPER_ADMIN,
            },
            create: {
              email,
              name: "Super Administrator",
              passwordHash: bootstrapPasswordHash,
              role: AdminRole.SUPER_ADMIN,
            },
            include: {
              seasons: { select: { seasonId: true } },
            },
          });

          return {
            id: bootstrapAdmin.id,
            name: bootstrapAdmin.name ?? bootstrapAdmin.email,
            email: bootstrapAdmin.email,
            role: bootstrapAdmin.role,
            adminSeasonIds: bootstrapAdmin.seasons.map(
              (season) => season.seasonId
            ),
          } satisfies {
            id: string;
            name: string;
            email: string;
            role: AuthRole;
            adminSeasonIds: string[];
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const adminUser = user as AdapterUser & {
          role?: AuthRole;
          adminSeasonIds?: string[];
        };
        token.role = adminUser.role;
        token.adminSeasonIds = adminUser.adminSeasonIds ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        session.user.role = token.role as AuthRole | undefined;
        session.user.adminSeasonIds = (token.adminSeasonIds as string[]) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);

export type { AuthRole };
