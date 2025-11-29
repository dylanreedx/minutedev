import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP, organization } from 'better-auth/plugins';
import {
  db,
  users,
  sessions,
  accounts,
  verifications,
  organization as organizationTable,
  member as memberTable,
  invitation,
  team,
  teamMember,
} from '@minute/db';
import { eq, and } from 'drizzle-orm';
import { Resend } from 'resend';
import { ac, owner, admin, member } from './permissions';

// Lazy initialization of Resend client
let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      organization: organizationTable,
      member: memberTable,
      invitation: invitation,
      team: team,
      teamMember: teamMember,
    },
  }),
  trustedOrigins: [
    'http://localhost:3000',
    'https://minutedev-web.vercel.app',
    // Support wildcard for Vercel preview deployments
    'https://*.vercel.app',
    // Add any other production/staging URLs from environment variable
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((origin) =>
          origin.trim()
        )
      : []),
  ],
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
    organization({
      ac,
      roles: { owner, admin, member },
      teams: {
        enabled: true,
        maximumTeams: 10,
        allowRemovingAllTeams: false,
      },
      async sendInvitationEmail(data) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviteLink = `${baseUrl}/accept-invite/${data.id}`;

        // In development, log invitation link to console and skip email sending
        const isDevelopment = process.env.NODE_ENV === 'development';

        console.log('\n' + '='.repeat(50));
        console.log(`📧 Team Invitation for ${data.email}`);
        console.log(`🔗 Invitation Link: ${inviteLink}`);
        console.log(
          `👤 Invited by: ${data.inviter.user.name} (${data.inviter.user.email})`
        );
        console.log(`🏢 Organization: ${data.organization.name}`);
        console.log(`👥 Role: ${data.role}`);
        console.log('='.repeat(50) + '\n');

        // In development, skip email sending to avoid Resend restrictions
        if (isDevelopment) {
          console.log(
            '⚠️  Development mode: Skipping email send. Use invitation link from console above.'
          );
          return;
        }

        // Production: Send actual email
        const resend = getResend();

        const subject = `You've been invited to join ${data.organization.name} on Minute`;
        const html = `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h1 style="color: #18181b;">You've been invited!</h1>
            <p style="color: #71717a;">
              <strong>${data.inviter.user.name}</strong> (${data.inviter.user.email}) has invited you to join 
              <strong>${data.organization.name}</strong> on Minute.
            </p>
            <p style="color: #71717a;">You'll be joining as a <strong>${data.role}</strong>.</p>
            <div style="margin: 32px 0;">
              <a 
                href="${inviteLink}" 
                style="display: inline-block; background: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;"
              >
                Accept Invitation
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 24px;">
              Or copy and paste this link into your browser:<br/>
              <span style="color: #71717a; word-break: break-all;">${inviteLink}</span>
            </p>
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 24px;">
              This invitation will expire in 48 hours.
            </p>
          </div>
        `;

        try {
          const result = await resend.emails.send({
            from: 'Minute <noreply@dylanreed.dev>',
            to: data.email,
            subject,
            html,
          });

          if (result.error) {
            console.error('Resend error:', result.error);
            throw new Error(
              `Failed to send invitation email: ${result.error.message}`
            );
          }

          console.log(
            '✅ Invitation email sent successfully:',
            result.data?.id
          );
        } catch (error) {
          console.error('❌ Error sending invitation email via Resend:', error);
          throw error;
        }
      },
    }),
    emailOTP({
      overrideDefaultEmailVerification: true, // Use OTP instead of verification links
      sendVerificationOnSignUp: true, // Send OTP automatically on sign up
      async sendVerificationOTP({ email, otp, type }) {
        // In development, log OTP to console and skip email sending
        const isDevelopment = process.env.NODE_ENV === 'development';

        console.log('\n' + '='.repeat(50));
        console.log(`📧 OTP for ${type} - ${email}`);
        console.log(`🔑 Verification Code: ${otp}`);
        console.log('='.repeat(50) + '\n');

        // In development, skip email sending to avoid Resend restrictions
        if (isDevelopment) {
          console.log(
            '⚠️  Development mode: Skipping email send. Use OTP from console above.'
          );
          return;
        }

        // Production: Send actual email
        const resend = getResend();

        let subject: string;
        let html: string;

        if (type === 'sign-in') {
          subject = 'Your sign-in code - Minute';
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
        } else if (type === 'email-verification') {
          subject = 'Verify your email - Minute';
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
          subject = 'Reset your password - Minute';
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
            from: 'Minute <noreply@dylanreed.dev>',
            to: email,
            subject,
            html,
          });

          if (result.error) {
            console.error('Resend error:', result.error);
            throw new Error(`Failed to send email: ${result.error.message}`);
          }

          console.log('✅ Email sent successfully:', result.data?.id);
        } catch (error) {
          console.error('❌ Error sending email via Resend:', error);
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
