"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { checkUsernameAvailability } from "./actions";

type AvailabilityState = "idle" | "checking" | "available" | "taken";

export function SignUpForm() {
  const t = useTranslations("auth.signUp");
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUsernameBlur = useCallback(async () => {
    if (!username || username.length < 3) return;
    setAvailability("checking");
    const { available } = await checkUsernameAvailability(username);
    setAvailability(available ? "available" : "taken");
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (username.length < 3) {
      setError(t("usernameMinLength"));
      return;
    }
    if (username.length > 30) {
      setError(t("usernameMaxLength"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordMinLength"));
      return;
    }

    // Re-check availability on submit
    const { available } = await checkUsernameAvailability(username);
    if (!available) {
      setAvailability("taken");
      setError(t("usernameTaken"));
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        email: `${username}@tiles.survive`,
        name: username,
        username,
        password,
      });

      if (result.error) {
        setError(t("errors.generic"));
        return;
      }

      router.push("/sign-up/pending");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  const availabilityMessage =
    availability === "checking"
      ? t("usernameChecking")
      : availability === "available"
        ? t("usernameAvailable")
        : availability === "taken"
          ? t("usernameTaken")
          : null;

  const availabilityColor =
    availability === "available"
      ? "text-cn-success"
      : availability === "taken"
        ? "text-cn-danger"
        : "text-text-muted";

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
          onChange={(e) => {
            setUsername(e.target.value);
            setAvailability("idle");
          }}
          onBlur={handleUsernameBlur}
          required
          minLength={3}
          maxLength={30}
        />
        {availabilityMessage && (
          <p className={`text-xs ${availabilityColor}`}>{availabilityMessage}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-text-primary">
          {t("password")}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <p className="text-xs text-text-muted">{t("passwordHint")}</p>
      </div>

      {error && <p className="text-sm text-cn-danger">{error}</p>}

      <Button type="submit" disabled={loading || availability === "taken"} className="w-full">
        {loading ? "…" : t("submit")}
      </Button>
    </form>
  );
}
