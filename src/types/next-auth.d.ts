import { AdminRole } from "@prisma/client";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: AdminRole;
      adminSeasonIds: string[];
    };
  }

  interface User {
    id: string;
    role?: AdminRole;
    adminSeasonIds?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AdminRole;
    adminSeasonIds?: string[];
  }
}
