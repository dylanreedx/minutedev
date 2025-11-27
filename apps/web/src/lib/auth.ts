import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { db, users, sessions, accounts, verifications } from "@minute/db";
import { Resend } from "resend";

// Lazy initialization of Resend client
let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Users must verify email before signing in
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true, // Use OTP instead of verification links
      sendVerificationOnSignUp: true, // Send OTP automatically on sign up
      async sendVerificationOTP({ email, otp, type }) {
        // In development, log OTP to console and skip email sending
        const isDevelopment = process.env.NODE_ENV === "development";
        
        console.log("\n" + "=".repeat(50));
        console.log(`📧 OTP for ${type} - ${email}`);
        console.log(`🔑 Verification Code: ${otp}`);
        console.log("=".repeat(50) + "\n");

        // In development, skip email sending to avoid Resend restrictions
        if (isDevelopment) {
          console.log("⚠️  Development mode: Skipping email send. Use OTP from console above.");
          return;
        }

        // Production: Send actual email
        const resend = getResend();
        
        let subject: string;
        let html: string;

        if (type === "sign-in") {
          subject = "Your sign-in code - Minute";
          html = `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h1 style="color: #18181b;">Sign in to Minute</h1>
              <p style="color: #71717a;">Use this code to sign in to your account:</p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b; font-family: monospace;">
                  ${otp}
                </div>
              </div>
              <p style="color: #71717a; font-size: 14px;">This code will expire in 5 minutes.</p>
              <p style="color: #a1a1aa; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
            </div>
          `;
        } else if (type === "email-verification") {
          subject = "Verify your email - Minute";
          html = `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h1 style="color: #18181b;">Verify your email</h1>
              <p style="color: #71717a;">Use this code to verify your email address:</p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b; font-family: monospace;">
                  ${otp}
                </div>
              </div>
              <p style="color: #71717a; font-size: 14px;">This code will expire in 5 minutes.</p>
            </div>
          `;
        } else {
          // forget-password
          subject = "Reset your password - Minute";
          html = `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h1 style="color: #18181b;">Reset your password</h1>
              <p style="color: #71717a;">Use this code to reset your password:</p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b; font-family: monospace;">
                  ${otp}
                </div>
              </div>
              <p style="color: #71717a; font-size: 14px;">This code will expire in 5 minutes.</p>
              <p style="color: #a1a1aa; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `;
        }

        try {
          const result = await resend.emails.send({
            from: "Minute <noreply@dylanreed.dev>",
            to: email,
            subject,
            html,
          });

          if (result.error) {
            console.error("Resend error:", result.error);
            throw new Error(`Failed to send email: ${result.error.message}`);
          }

          console.log("✅ Email sent successfully:", result.data?.id);
        } catch (error) {
          console.error("❌ Error sending email via Resend:", error);
          throw error;
        }
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
    }),
    nextCookies(), // Must be last plugin
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
