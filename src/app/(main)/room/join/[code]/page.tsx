"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function JoinRoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/rooms/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); router.replace(`/room/${body.roomId}`); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not join room.")); }, [code, router]);
  return <main className="grid min-h-dvh place-items-center bg-[var(--bg-canvas)] text-[var(--text-secondary)]">{error || <Loader2 className="h-6 w-6 animate-spin" />}</main>;
}
