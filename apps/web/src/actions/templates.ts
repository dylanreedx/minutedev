"use server";

import { db } from "@/lib/db";
import { ticketTemplates, type TicketStatus, type TicketPriority } from "@minute/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Input types
export type CreateTemplateInput = {
  projectId: string;
  name: string;
  description?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  defaultStatus?: TicketStatus;
  defaultPriority?: TicketPriority;
  defaultPoints?: number;
};

export type UpdateTemplateInput = {
  id: string;
  name?: string;
  description?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  defaultStatus?: TicketStatus;
  defaultPriority?: TicketPriority;
  defaultPoints?: number | null;
};

// Create a new ticket template
export async function createTemplate(data: CreateTemplateInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const [template] = await db
    .insert(ticketTemplates)
    .values({
      projectId: data.projectId,
      creatorId: session.user.id,
      name: data.name,
      description: data.description,
      titleTemplate: data.titleTemplate,
      descriptionTemplate: data.descriptionTemplate,
      defaultStatus: data.defaultStatus || "backlog",
      defaultPriority: data.defaultPriority || "medium",
      defaultPoints: data.defaultPoints,
    })
    .returning();

  revalidatePath(`/projects`);
  return template;
}

// Get all templates for a project
export async function getTemplates(projectId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const templates = await db
    .select()
    .from(ticketTemplates)
    .where(eq(ticketTemplates.projectId, projectId))
    .orderBy(ticketTemplates.name);

  return templates;
}

// Get a single template by ID
export async function getTemplate(templateId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const [template] = await db
    .select()
    .from(ticketTemplates)
    .where(eq(ticketTemplates.id, templateId));

  return template || null;
}

// Update a template
export async function updateTemplate(data: UpdateTemplateInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.titleTemplate !== undefined) updateData.titleTemplate = data.titleTemplate;
  if (data.descriptionTemplate !== undefined) updateData.descriptionTemplate = data.descriptionTemplate;
  if (data.defaultStatus !== undefined) updateData.defaultStatus = data.defaultStatus;
  if (data.defaultPriority !== undefined) updateData.defaultPriority = data.defaultPriority;
  if (data.defaultPoints !== undefined) updateData.defaultPoints = data.defaultPoints;

  const [template] = await db
    .update(ticketTemplates)
    .set(updateData)
    .where(eq(ticketTemplates.id, data.id))
    .returning();

  revalidatePath(`/projects`);
  return template;
}

// Delete a template
export async function deleteTemplate(templateId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  await db.delete(ticketTemplates).where(eq(ticketTemplates.id, templateId));

  revalidatePath(`/projects`);
  return { success: true };
}

// Type exports
export type TicketTemplate = typeof ticketTemplates.$inferSelect;

