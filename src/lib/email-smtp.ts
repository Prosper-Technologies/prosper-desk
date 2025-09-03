import nodemailer from 'nodemailer';

// Alternative SMTP email service using Gmail (no domain required)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // your-email@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // app-specific password
  },
});

export const smtpEmailService = {
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
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject: `You've been invited to join ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to join ${companyName}</h2>
            <p>Hi there!</p>
            <p>${inviterName} has invited you to join their support team.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p>If the button doesn't work, copy this link: ${inviteLink}</p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error('SMTP email error:', error);
      throw error;
    }
  },
};