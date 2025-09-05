import { db } from "~/db";
import { invitationCodes } from "~/db/schema";
import { eq, and, gt } from "drizzle-orm";

export function generateInvitationCode(): string {
  // Generate a 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createInvitationCode({
  companyId,
  userId,
  role,
  invitedByMembershipId,
}: {
  companyId: string;
  userId: string;
  role: "admin" | "agent";
  invitedByMembershipId: string;
}): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  // Keep generating codes until we find a unique one
  do {
    code = generateInvitationCode();
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error("Unable to generate unique invitation code");
    }

    // Check if code already exists
    const existing = await db.query.invitationCodes.findFirst({
      where: eq(invitationCodes.code, code),
    });

    if (!existing) {
      break;
    }
  } while (true);

  // Create expiration date (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Insert the invitation code
  await db.insert(invitationCodes).values({
    company_id: companyId,
    user_id: userId,
    code,
    role,
    invited_by_membership_id: invitedByMembershipId,
    expires_at: expiresAt,
  });

  return code;
}

export async function validateInvitationCode(code: string): Promise<{
  isValid: boolean;
  invitation?: {
    id: string;
    companyId: string;
    userId: string;
    role: "admin" | "agent";
    companySlug?: string;
    companyName?: string;
    userEmail?: string;
  };
  error?: string;
}> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return {
      isValid: false,
      error: "Invalid code format. Please enter a 6-digit numeric code.",
    };
  }

  // Find the invitation code with company and user info
  const invitation = await db.query.invitationCodes.findFirst({
    where: and(
      eq(invitationCodes.code, code),
      eq(invitationCodes.is_used, false),
      gt(invitationCodes.expires_at, new Date())
    ),
    with: {
      company: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        columns: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!invitation) {
    return {
      isValid: false,
      error: "Invalid or expired invitation code. Please check the code or request a new invitation.",
    };
  }

  return {
    isValid: true,
    invitation: {
      id: invitation.id,
      companyId: invitation.company_id,
      userId: invitation.user_id,
      role: invitation.role,
      companySlug: invitation.company.slug,
      companyName: invitation.company.name,
      userEmail: invitation.user.email,
    },
  };
}

export async function useInvitationCode(codeId: string): Promise<void> {
  await db
    .update(invitationCodes)
    .set({
      is_used: true,
      used_at: new Date(),
    })
    .where(eq(invitationCodes.id, codeId));
}

export async function cleanupExpiredCodes(): Promise<number> {
  const result = await db
    .delete(invitationCodes)
    .where(
      and(
        eq(invitationCodes.is_used, false),
        gt(new Date(), invitationCodes.expires_at)
      )
    )
    .returning({ id: invitationCodes.id });

  return result.length;
}