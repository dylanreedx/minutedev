import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "./auth";
import { headers } from "next/headers";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
const fileRouter = {
  // Define a route for ticket attachments
  ticketAttachment: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    pdf: { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "32MB", maxFileCount: 3 },
    blob: { maxFileSize: "8MB", maxFileCount: 5 }, // Other file types
  })
    .middleware(async () => {
      // Get the session using Better Auth
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user) {
        throw new UploadThingError("Unauthorized");
      }

      // Return user ID for use in onUploadComplete
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs on the server after upload
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);

      // Return data to the client
      return { 
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),
} satisfies FileRouter;

export const ourFileRouter = fileRouter;
export type OurFileRouter = typeof fileRouter;
