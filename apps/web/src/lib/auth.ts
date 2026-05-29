import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@tiles-survive/database";

const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: { enabled: true },
  plugins: [
    username({
      usernameNormalization: false,
      usernameValidator: (u) => /^[\p{L}\p{N}_.]+$/u.test(u),
    }),
    admin(),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      platformStatus: { type: "string", defaultValue: "PENDING" },
      language: { type: "string", defaultValue: "en" },
      allianceMemberId: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const count = await prisma.user.count();
          if (count === 0) {
            return {
              data: {
                ...user,
                role: "admin",
                platformStatus: "ACTIVE",
                emailVerified: true,
              },
            };
          }
          return { data: { ...user, platformStatus: "PENDING", role: "r1" } };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
