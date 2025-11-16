"use server";

import { SystemRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session || session.user?.systemRole !== SystemRole.SUPER_ADMIN) {
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
});

export async function createAdminUser(formData: FormData) {
  await requireSuperAdmin();

  const raw = {
    email: formData.get("email")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? undefined,
    password: formData.get("password")?.toString() ?? "",
  } satisfies Record<string, unknown>;

  const parsed = createAdminSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to create admin";
    throw new Error(message);
  }

  const { email, name, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new Error("A user with that email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      systemRole: SystemRole.SUPER_ADMIN,
    },
  });

  revalidatePath("/admins");
}

const updatePasswordSchema = z.object({
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

  const parsed = updatePasswordSchema.safeParse(raw);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Unable to update password";
    throw new Error(message);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({
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

  const remainingSuperAdmins = await prisma.user.count({
    where: {
      systemRole: SystemRole.SUPER_ADMIN,
      id: { not: parsed.data.adminId },
    },
  });

  if (remainingSuperAdmins === 0) {
    throw new Error("At least one super admin is required");
  }

  await prisma.user.update({
    where: { id: parsed.data.adminId },
    data: { systemRole: null },
  });

  revalidatePath("/admins");
}
