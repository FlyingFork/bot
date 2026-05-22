import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { prisma } from "@tiles-survive/database";

// ── Change this before running ────────────────────────────────────────────────
const TEMP_PASSWORD = "Alex2020!";
const TARGET_USERNAME = "Hade";
// ─────────────────────────────────────────────────────────────────────────────

async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  const b64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return encodeURIComponent(`${value}.${b64}`);
}

// Minimal auth instance — no nextCookies so this runs outside Next.js.
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true },
  plugins: [username({ usernameNormalization: false }), admin()],
});

async function main() {
  const targetUser = await prisma.user.findFirst({
    where: { username: TARGET_USERNAME },
  });
  if (!targetUser) throw new Error(`User '${TARGET_USERNAME}' not found`);

  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!adminUser) throw new Error("No admin user found in the database");

  // Reuse an existing valid admin session; otherwise create a short-lived one.
  let session = await prisma.session.findFirst({
    where: { userId: adminUser.id, expiresAt: { gt: new Date() } },
  });

  let createdTempSession = false;
  if (!session) {
    session = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        userId: adminUser.id,
        expiresAt: new Date(Date.now() + 60_000), // 1 minute
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: "127.0.0.1",
        userAgent: "reset-password-script",
      },
    });
    createdTempSession = true;
  }

  try {
    const secret = process.env.BETTER_AUTH_SECRET!;
    const signedToken = await signCookieValue(session.token, secret);
    await auth.api.setUserPassword({
      body: { userId: targetUser.id, newPassword: TEMP_PASSWORD },
      headers: new Headers({
        cookie: `better-auth.session_token=${signedToken}`,
      }),
    });
    console.log(
      `Password reset for '${targetUser.username}' (id: ${targetUser.id})`,
    );
  } finally {
    if (createdTempSession) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
