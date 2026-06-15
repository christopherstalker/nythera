"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ImagePlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Profile = {
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  role: string;
  ageVerified: boolean;
};

export function ProfileSettingsClient() {
  const { status: sessionStatus } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarValue, setAvatarValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    if (sessionStatus === "unauthenticated") {
      setStatus("Sign in to edit profile settings.");
      return;
    }

    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setProfile(body.profile))
      .catch(() => setStatus("Sign in to edit profile settings."));
  }, [sessionStatus]);

  useEffect(() => {
    setAvatarValue(profile?.avatarUrl ?? "");
  }, [profile?.avatarUrl]);

  function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file.");
      return;
    }

    if (file.size > 1_500_000) {
      setStatus("Avatar image must be smaller than 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarValue(String(reader.result ?? ""));
      setStatus(null);
    };
    reader.onerror = () => setStatus("Could not read avatar image.");
    reader.readAsDataURL(file);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: data.get("username"),
        avatarUrl: avatarValue,
        bio: data.get("bio"),
        ageVerified: data.get("ageVerified") === "on"
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save profile.");
      return;
    }

    const body = await response.json();
    setProfile(body.profile);
    window.dispatchEvent(new CustomEvent("nythera:profile-updated", { detail: { profile: body.profile } }));
    setStatus("Profile saved.");
  }

  return (
    <form key={profile?.email ?? "loading-profile"} onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <Input name="email" value={profile?.email ?? ""} disabled placeholder="Email" />
      <Input name="username" defaultValue={profile?.username ?? ""} placeholder="Username" />
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4 shadow-[var(--glass-highlight)] backdrop-blur-xl lg:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={profile?.email ?? "N"} src={avatarValue} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">Profile avatar</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">PNG, JPG, WebP, GIF, or SVG up to 1.5MB.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-purple-soft)]">
                <ImagePlus className="h-4 w-4" />
                Choose file
                <input type="file" accept="image/*" className="sr-only" onChange={onAvatarFile} />
              </label>
              {avatarValue ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setAvatarValue("")}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <label className="flex min-h-12 min-w-0 items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm leading-5 text-[var(--text-secondary)] shadow-[var(--glass-highlight)] backdrop-blur-xl sm:items-center sm:py-0">
        <input name="ageVerified" type="checkbox" defaultChecked={profile?.ageVerified ?? false} className="accent-[var(--accent-purple)]" />
        <span className="min-w-0">I confirm I can access age-gated content settings</span>
      </label>
      <Textarea name="bio" defaultValue={profile?.bio ?? ""} placeholder="Bio" className="lg:col-span-2" />
      <Button type="submit" className="w-fit">Save profile</Button>
      {status ? <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)] lg:col-span-2">{status}</p> : null}
    </form>
  );
}
