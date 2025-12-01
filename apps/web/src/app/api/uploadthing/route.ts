import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing";

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    // Token is automatically read from UPLOADTHING_TOKEN env var
    // No need to pass it explicitly here
  },
});

// Ensure this route uses Node.js runtime (not edge) for better compatibility
export const runtime = "nodejs";

