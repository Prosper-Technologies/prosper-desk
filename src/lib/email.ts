import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailService = {
  async sendInvitation({
    to,
    companyName,
    inviterName,
    invitationCode,
    companySlug,
  }: {
    to: string;
    companyName: string;
    inviterName: string;
    invitationCode: string;
    companySlug: string;
  }) {
    try {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/invite/${companySlug}`;

      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject: `You've been invited to join ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to join ${companyName}</h2>
            <p>Hi there!</p>
            <p>${inviterName} has invited you to join their support team at ${companyName}.</p>

            <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #495057;">Your Invitation Code</h3>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; font-family: 'Courier New', monospace;">
                ${invitationCode}
              </div>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #6c757d;">
                Enter this code to complete your registration
              </p>
            </div>

            <p><strong>To get started:</strong></p>
            <ol style="padding-left: 20px;">
              <li>Visit: <a href="${inviteUrl}" style="color: #3b82f6;">${inviteUrl}</a></li>
              <li>Enter your invitation code: <strong>${invitationCode}</strong></li>
              <li>Complete your account setup</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}"
                 style="background-color: #3b82f6; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This invitation code will expire in 7 days. If you didn't expect this invitation,
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

  async sendTest({
    to,
    fromDomain = 'useblueos.com',
  }: {
    to: string;
    fromDomain?: string;
  }) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || `noreply@${fromDomain}`,
        to,
        subject: `Test Email from ${fromDomain}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>🚀 Email Configuration Test</h2>
            <p>Hi there!</p>
            <p>This is a test email to verify that your email service is working correctly with your ${fromDomain} domain.</p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>✅ Configuration Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Domain:</strong> ${fromDomain}</li>
                <li><strong>From Address:</strong> ${process.env.FROM_EMAIL || `noreply@${fromDomain}`}</li>
                <li><strong>Service:</strong> Resend</li>
                <li><strong>Status:</strong> Working correctly!</li>
              </ul>
            </div>

            <p>If you received this email, your Resend integration is properly configured and ready to send emails from your custom domain.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This is a test email sent from Prosper Desk to verify email configuration.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Test email sending failed:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Test email service error:', error);
      throw error;
    }
  },

  async sendPortalMagicLink({
    to,
    customerName,
    companyName,
    clientName,
    magicLink,
  }: {
    to: string;
    customerName: string;
    companyName: string;
    clientName: string;
    magicLink: string;
  }) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@resend.dev',
        to,
        subject: `Access Your ${companyName} Support Portal`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${companyName} Support Portal</h2>
            <p>Hi ${customerName},</p>
            <p>You've been granted access to the ${companyName} support portal for ${clientName}.</p>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${magicLink}"
                 style="background-color: #3b82f6; color: white; padding: 14px 28px;
                        text-decoration: none; border-radius: 6px; display: inline-block;
                        font-weight: 600; font-size: 16px;">
                Access Portal
              </a>
            </div>

            <p><strong>What you can do in the portal:</strong></p>
            <ul style="padding-left: 20px;">
              <li>View and track your support tickets</li>
              <li>Create new support requests</li>
              <li>Communicate with the support team</li>
              <li>Access knowledge base articles</li>
            </ul>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This magic link will expire in 1 hour for security reasons.
              If you didn't request this access, you can safely ignore this email.
            </p>
            <p style="color: #666; font-size: 12px;">
              For security, don't share this link with anyone else.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Magic link email failed:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Magic link email service error:', error);
      throw error;
    }
  },
};
