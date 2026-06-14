"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ImagePlus, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/components/ui/page";

type Profile = {
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  role: string;
  ageVerified: boolean;
};

export function ProfileSettingsClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarValue, setAvatarValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setProfile(body.profile))
      .catch(() => setStatus("Sign in to edit profile settings."));
  }, []);

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
    window.dispatchEvent(new CustomEvent("velora:profile-updated", { detail: { profile: body.profile } }));
    setStatus("Profile saved.");
  }

  return (
    <Surface className="p-6">
      <div className="flex items-start gap-3">
        <UserCog className="mt-1 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Public identity, avatar, and safety preferences.</p>
        </div>
      </div>
      <form key={profile?.email ?? "loading-profile"} onSubmit={onSubmit} className="mt-6 grid gap-4 lg:grid-cols-2">
        <Input name="email" value={profile?.email ?? ""} disabled placeholder="Email" />
        <Input name="username" defaultValue={profile?.username ?? ""} placeholder="Username" />
        <div className="rounded-[26px] border border-white/[0.025] bg-white/[0.024] p-5 shadow-inset lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-lg font-semibold uppercase text-foreground">
              {avatarValue ? <img src={avatarValue} alt="" className="h-full w-full object-cover" /> : profile?.email?.slice(0, 1) ?? "V"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Profile avatar</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose an image from your computer. PNG, JPG, WebP, GIF, or SVG up to 1.5MB.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary/[0.11] px-4 text-sm font-medium text-foreground shadow-inset transition hover:bg-primary/[0.16]">
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
        <label className="flex min-h-12 items-center gap-2 rounded-[22px] border border-white/[0.035] bg-white/[0.032] px-4 text-sm shadow-inset">
          <input name="ageVerified" type="checkbox" defaultChecked={profile?.ageVerified ?? false} className="accent-[hsl(var(--primary))]" />
          I confirm I can access age-gated content settings
        </label>
        <Textarea name="bio" defaultValue={profile?.bio ?? ""} placeholder="Bio" className="lg:col-span-2" />
        <Button type="submit" className="w-fit">Save profile</Button>
      </form>
      {status ? <p className="mt-3 rounded-2xl border border-white/[0.055] bg-white/[0.028] p-3 text-sm text-muted-foreground shadow-inset">{status}</p> : null}
    </Surface>
  );
}
