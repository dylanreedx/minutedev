"use client";

import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";

import type { OurFileRouter } from "./uploadthing";

// Generate typed components
// In Next.js, these automatically detect /api/uploadthing
// No URL configuration needed unless using a custom endpoint
const uploadButtonFactory = generateUploadButton<OurFileRouter>;
const uploadDropzoneFactory = generateUploadDropzone<OurFileRouter>;
const reactHelpersFactory = generateReactHelpers<OurFileRouter>;

// Export typed components
// These will automatically use /api/uploadthing in Next.js
export const UploadButton = uploadButtonFactory();
export const UploadDropzone = uploadDropzoneFactory();

const helpers = reactHelpersFactory();
export const useUploadThing = helpers.useUploadThing;
export const uploadFiles = helpers.uploadFiles;
