"use server";

import { db } from "@/lib/db";
import { attachments } from "@minute/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

// Input types
export type CreateAttachmentInput = {
  ticketId: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
};

// Create an attachment record after upload
export async function createAttachment(data: CreateAttachmentInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const [attachment] = await db
    .insert(attachments)
    .values({
      ticketId: data.ticketId,
      userId: session.user.id,
      fileKey: data.fileKey,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      fileType: data.fileType,
    })
    .returning();

  revalidatePath(`/projects`);
  return attachment;
}

// Get attachments for a ticket
export async function getAttachments(ticketId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const ticketAttachments = await db
    .select()
    .from(attachments)
    .where(eq(attachments.ticketId, ticketId))
    .orderBy(attachments.createdAt);

  return ticketAttachments;
}

// Delete an attachment
export async function deleteAttachment(attachmentId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Get the attachment first to check ownership and get file key
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId));

  if (!attachment) {
    throw new Error("Attachment not found");
  }

  // Only allow owner to delete
  if (attachment.userId !== session.user.id) {
    throw new Error("Not authorized to delete this attachment");
  }

  // Delete from UploadThing
  try {
    await utapi.deleteFiles(attachment.fileKey);
  } catch (error) {
    console.error("Failed to delete file from UploadThing:", error);
    // Continue to delete from DB even if UploadThing fails
  }

  // Delete from database
  await db.delete(attachments).where(eq(attachments.id, attachmentId));

  revalidatePath(`/projects`);
  return { success: true };
}

// Type exports
export type Attachment = typeof attachments.$inferSelect;

