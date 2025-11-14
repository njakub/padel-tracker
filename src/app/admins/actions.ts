"use server";

import { AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session || session.user?.role !== AdminRole.SUPER_ADMIN) {
    throw new Error("Super admin permissions required");
  }

  return session;
}

const createAdminSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  name: z.string().trim().max(120).optional(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  role: z.nativeEnum(AdminRole),
  seasonIds: z.array(z.string().min(1)).default([]),
});

export async function createAdminUser(formData: FormData) {
  await requireSuperAdmin();

  const seasonIds = formData
    .getAll("seasonIds")
    .map((value) => value?.toString().trim())
    .filter((value): value is string => Boolean(value));

  const raw = {
    email: formData.get("email")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? undefined,
    password: formData.get("password")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? AdminRole.SEASON_ADMIN,
    seasonIds,
  } satisfies Record<string, unknown>;

  const parsed = createAdminSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to create admin";
    throw new Error(message);
  }

  const data = parsed.data;

  if (data.role === AdminRole.SEASON_ADMIN && data.seasonIds.length === 0) {
    throw new Error("Season admins must be assigned at least one season");
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    throw new Error("An admin with that email already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  await prisma.adminUser.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role,
      seasons:
        data.role === AdminRole.SEASON_ADMIN
          ? {
              createMany: {
                data: data.seasonIds.map((seasonId) => ({ seasonId })),
                skipDuplicates: true,
              },
            }
          : undefined,
    },
  });

  revalidatePath("/admins");
  revalidatePath("/schedule");
  revalidatePath("/matches");
}

const updateAdminSeasonsSchema = z.object({
  adminId: z.string().cuid({ message: "Invalid admin" }),
  seasonIds: z.array(z.string().min(1)).default([]),
});

export async function updateAdminSeasons(formData: FormData) {
  await requireSuperAdmin();

  const seasonIds = formData
    .getAll("seasonIds")
    .map((value) => value?.toString().trim())
    .filter((value): value is string => Boolean(value));

  const raw = {
    adminId: formData.get("adminId")?.toString() ?? "",
    seasonIds,
  } satisfies Record<string, unknown>;

  const parsed = updateAdminSeasonsSchema.safeParse(raw);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Unable to update seasons";
    throw new Error(message);
  }

  const data = parsed.data;

  const admin = await prisma.adminUser.findUnique({
    where: { id: data.adminId },
    select: { role: true },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  if (admin.role !== AdminRole.SEASON_ADMIN) {
    throw new Error("Only season admins can be assigned seasons");
  }

  const operations = [
    prisma.seasonAdmin.deleteMany({ where: { adminUserId: data.adminId } }),
  ];

  if (data.seasonIds.length > 0) {
    operations.push(
      prisma.seasonAdmin.createMany({
        data: data.seasonIds.map((seasonId) => ({
          adminUserId: data.adminId,
          seasonId,
        })),
      })
    );
  }

  await prisma.$transaction(operations);

  revalidatePath("/admins");
  revalidatePath("/schedule");
  revalidatePath("/matches");
}

const updateAdminPasswordSchema = z.object({
  adminId: z.string().cuid({ message: "Invalid admin" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

export async function updateAdminPassword(formData: FormData) {
  await requireSuperAdmin();

  const raw = {
    adminId: formData.get("adminId")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
  } satisfies Record<string, unknown>;

  const parsed = updateAdminPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Unable to update password";
    throw new Error(message);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.adminUser.update({
    where: { id: parsed.data.adminId },
    data: { passwordHash },
  });

  revalidatePath("/admins");
}

const deleteAdminSchema = z.object({
  adminId: z.string().cuid({ message: "Invalid admin" }),
});

export async function deleteAdmin(formData: FormData) {
  const session = await requireSuperAdmin();

  const raw = {
    adminId: formData.get("adminId")?.toString() ?? "",
  } satisfies Record<string, unknown>;

  const parsed = deleteAdminSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to delete admin";
    throw new Error(message);
  }

  if (session.user.id === parsed.data.adminId) {
    throw new Error("You cannot delete your own account");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: parsed.data.adminId },
    select: { role: true },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  if (admin.role === AdminRole.SUPER_ADMIN) {
    const remainingSuperAdmins = await prisma.adminUser.count({
      where: { role: AdminRole.SUPER_ADMIN, id: { not: parsed.data.adminId } },
    });

    if (remainingSuperAdmins === 0) {
      throw new Error("At least one super admin is required");
    }
  }

  await prisma.adminUser.delete({ where: { id: parsed.data.adminId } });

  revalidatePath("/admins");
  revalidatePath("/schedule");
  revalidatePath("/matches");
}
