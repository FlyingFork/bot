"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const t = useTranslations("auth.signIn");
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signIn.username({
        username,
        password,
      });

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          router.push("/sign-up/pending");
          return;
        }
        setError(t("errors.invalidCredentials"));
        return;
      }

      // Check emailVerified on the returned user
      if (result.data?.user && !result.data.user.emailVerified) {
        // Sign out to prevent an unverified session being used
        await authClient.signOut();
        router.push("/sign-up/pending");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium text-text-primary">
          {t("username")}
        </label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          placeholder={t("usernamePlaceholder")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-text-primary">
          {t("password")}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-cn-danger">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "…" : t("submit")}
      </Button>
    </form>
  );
}
