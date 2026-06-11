"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserCog } from "lucide-react";
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setProfile(body.profile))
      .catch(() => setStatus("Sign in to edit profile settings."));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: data.get("username"),
        avatarUrl: data.get("avatarUrl"),
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
    setStatus("Profile saved.");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card-glow">
      <div className="flex items-center gap-3">
        <UserCog className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Public identity and safety flags.</p>
        </div>
      </div>
      <form key={profile?.email ?? "loading-profile"} onSubmit={onSubmit} className="mt-5 grid gap-3 lg:grid-cols-2">
        <Input name="email" value={profile?.email ?? ""} disabled placeholder="Email" />
        <Input name="username" defaultValue={profile?.username ?? ""} placeholder="Username" />
        <Input name="avatarUrl" defaultValue={profile?.avatarUrl ?? ""} placeholder="Avatar URL" />
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-[hsl(var(--input))] px-3 text-sm">
          <input name="ageVerified" type="checkbox" defaultChecked={profile?.ageVerified ?? false} className="accent-[hsl(var(--primary))]" />
          I confirm I can access age-gated content settings
        </label>
        <Textarea name="bio" defaultValue={profile?.bio ?? ""} placeholder="Bio" className="lg:col-span-2" />
        <Button type="submit" className="w-fit">Save profile</Button>
      </form>
      {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}
    </section>
  );
}
