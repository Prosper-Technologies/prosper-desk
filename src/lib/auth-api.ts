import { NextRequest } from "next/server";
import { db } from "~/db";
import { apiKeys, companies } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface ApiKeyContext {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  permissions: string[];
}

export async function validateApiKey(
  request: NextRequest,
): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (!apiKey) {
    return null;
  }

  try {
    // Extract prefix from the key
    const prefix = apiKey.substring(0, 8);
    
    // Find API key by prefix
    const keyRecord = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.prefix, prefix),
        eq(apiKeys.is_active, true),
      ),
      with: {
        company: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!keyRecord) {
      return null;
    }

    // Check if key is expired
    if (keyRecord.expires_at && keyRecord.expires_at < new Date()) {
      return null;
    }

    // Verify the key hash
    const isValidKey = await bcrypt.compare(apiKey, keyRecord.key_hash);
    
    if (!isValidKey) {
      return null;
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ last_used_at: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    return {
      company: keyRecord.company,
      permissions: keyRecord.permissions as string[],
    };
  } catch (error) {
    console.error("API key validation error:", error);
    return null;
  }
}

export function hasPermission(context: ApiKeyContext, permission: string): boolean {
  return context.permissions.includes(permission) || context.permissions.includes("*");
}

export async function generateApiKey(
  companyId: string,
  name: string,
  permissions: string[] = [],
  expiresAt?: Date,
): Promise<{ key: string; id: string }> {
  // Generate a random API key
  const key = `bdk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
  const prefix = key.substring(0, 8);
  const keyHash = await bcrypt.hash(key, 12);

  const [apiKeyRecord] = await db
    .insert(apiKeys)
    .values({
      company_id: companyId,
      name,
      key_hash: keyHash,
      prefix,
      permissions,
      expires_at: expiresAt,
    })
    .returning();

  return {
    key,
    id: apiKeyRecord!.id,
  };
}