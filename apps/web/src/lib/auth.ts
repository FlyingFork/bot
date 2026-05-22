import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@tiles-survive/database";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username({
      // Store usernames in original case to avoid Turkish dotted-i issues
      // with JS toLocaleLowerCase(). Comparisons are done case-sensitively.
      usernameNormalization: false,
    }),
    admin(),
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const count = await prisma.user.count();
          if (count === 0) {
            return { data: { ...user, role: "admin", emailVerified: true } };
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
