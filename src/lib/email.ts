import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailService = {
  async sendInvitation({
    to,
    companyName,
    inviterName,
    inviteLink,
  }: {
    to: string;
    companyName: string;
    inviterName: string;
    inviteLink: string;
  }) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject: `You've been invited to join ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to join ${companyName}</h2>
            <p>Hi there!</p>
            <p>${inviterName} has invited you to join their support team at ${companyName}.</p>
            <p>Click the button below to accept your invitation and set up your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${inviteLink}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, 
              you can safely ignore this email.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Email sending failed:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      throw error;
    }
  },

  async sendWelcome({
    to,
    firstName,
    companyName,
  }: {
    to: string;
    firstName: string;
    companyName: string;
  }) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject: `Welcome to ${companyName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${companyName}!</h2>
            <p>Hi ${firstName},</p>
            <p>Welcome to the team! Your account has been successfully created.</p>
            <p>You can now access your dashboard and start managing support tickets.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
                 style="background-color: #10b981; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            <p>If you have any questions, don't hesitate to reach out to your team administrator.</p>
            <p>Best regards,<br>The ${companyName} Team</p>
          </div>
        `,
      });

      if (error) {
        console.error('Welcome email failed:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Welcome email service error:', error);
      throw error;
    }
  },
};