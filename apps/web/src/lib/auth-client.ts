"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // baseURL defaults to current origin
  plugins: [emailOTPClient()],
});

// Export commonly used functions for convenience
export const { signIn, signUp, signOut, useSession } = authClient;

// Export email OTP methods explicitly
export const { sendVerificationOtp, verifyEmail, checkVerificationOtp } = authClient.emailOtp;
