"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { ac, owner, admin, member } from "./permissions";

export const authClient = createAuthClient({
  // baseURL defaults to current origin
  plugins: [
    organizationClient({
      ac,
      roles: { owner, admin, member },
      teams: {
        enabled: true,
      },
    }),
    emailOTPClient(),
  ],
});

// Export commonly used functions for convenience
export const { signIn, signUp, signOut, useSession } = authClient;

// Export email OTP methods explicitly
export const { sendVerificationOtp, verifyEmail, checkVerificationOtp } = authClient.emailOtp;
