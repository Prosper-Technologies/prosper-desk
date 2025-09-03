# Gmail Integration Setup Guide

This guide will help you set up Gmail integration to automatically convert emails into support tickets.

## 🚀 Quick Start

### 1. Google Cloud Console Setup

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Create or select a project**
3. **Enable Gmail API:**
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API" and enable it

### 2. Create OAuth2 Credentials

1. **Go to "APIs & Services" → "Credentials"**
2. **Click "Create Credentials" → "OAuth 2.0 Client IDs"**
3. **Configure OAuth consent screen** (if not done):
   - User Type: External (for testing) or Internal (for organization)
   - App name: Your app name
   - User support email: Your email
   - Scopes: Add Gmail scopes (done automatically)
4. **Create OAuth Client:**
   - Application type: Web application
   - Name: Gmail Integration
   - Authorized redirect URIs: `http://localhost:3000/settings/gmail`

### 3. Environment Variables

Add these variables to your `.env` file:

```env
# Gmail Integration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/settings/gmail

# For production, update the redirect URI:
# GOOGLE_REDIRECT_URI=https://yourdomain.com/settings/gmail
```

### 4. Database Migration

The Gmail integration requires new database tables. Run:

```bash
# Generate migration (if using Drizzle migrations)
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit migrate
```

Or manually create the tables using the schema in `src/db/schema.ts`:
- `gmail_integration`
- `email_threads`

## 🔧 How It Works

### 1. **Authentication Flow**
```
User clicks "Connect Gmail" → Google OAuth → Callback → Store tokens
```

### 2. **Email Processing**
```
Manual Sync → Fetch emails → Parse content → Create tickets → Link threads
```

### 3. **Ticket Creation**
- Each Gmail thread becomes a support ticket
- Email sender becomes the customer
- Subject becomes ticket title
- Email body becomes ticket description

## 📧 Features Included

### ✅ **Current Features**
- ✅ OAuth2 authentication with Google
- ✅ Manual email sync (last 7 days)
- ✅ Automatic ticket creation from emails
- ✅ Thread tracking to prevent duplicates
- ✅ Connection testing
- ✅ Integration status monitoring

### 🚧 **Coming Soon**
- 🚧 Real-time email webhooks
- 🚧 Reply-to-email functionality
- 🚧 Automatic periodic sync
- 🚧 Email template customization
- 🚧 Multiple email account support

## 🛠️ Usage

### 1. **Connect Gmail Account**
1. Go to `Settings → Gmail Integration`
2. Click "Connect Gmail"
3. Authorize your Google account
4. Verify connection with "Test Connection"

### 2. **Sync Emails**
1. Click "Sync Now" to process recent emails
2. Check the results in the sync status
3. View new tickets in your dashboard

### 3. **Monitor Integration**
- Connection status shows account info
- Last sync time is displayed
- Sync results show processed emails

## 🔒 Security & Privacy

### **Data Access**
- Only accesses Gmail with explicit user permission
- Reads emails to create tickets (read-only for email content)
- Can send emails for replies (future feature)
- Tokens are securely stored in your database

### **Permissions Required**
- `gmail.readonly`: Read email messages
- `gmail.send`: Send reply emails (future)
- `gmail.modify`: Mark emails as read
- `userinfo.email`: Get account email address

### **Data Storage**
- OAuth tokens encrypted in database
- Email metadata stored (subject, participants, thread IDs)
- Full email content not permanently stored
- Integration can be disconnected anytime

## 🐛 Troubleshooting

### **Common Issues**

**"Failed to get access tokens"**
- Check Google Client ID and Secret
- Verify redirect URI matches exactly
- Ensure Gmail API is enabled

**"Connection test failed"**
- Token may have expired
- Reconnect Gmail account
- Check API quotas in Google Cloud Console

**"No emails processed"**
- Only processes unread emails from last 7 days
- Check email filters or labels
- Verify account has unread emails

**"Tickets not created"**
- Check database permissions
- Verify company/user context
- Check server logs for errors

### **Debug Steps**
1. Check server console for error messages
2. Verify environment variables are loaded
3. Test database connectivity
4. Check Gmail API quotas and limits
5. Verify OAuth scopes in Google Cloud Console

## 📞 Support

Need help with Gmail integration?

1. **Check the troubleshooting section above**
2. **Review server logs** for specific error messages
3. **Verify all setup steps** are completed correctly
4. **Test with a simple email** to confirm basic functionality

---

## 🚀 Next Steps

After setting up Gmail integration:

1. **Test the flow** with a sample email
2. **Configure email templates** (when available)
3. **Set up automatic sync** (when available)
4. **Train your team** on the new workflow
5. **Monitor sync results** regularly

The Gmail integration is designed to streamline your support workflow by automatically converting customer emails into trackable support tickets!