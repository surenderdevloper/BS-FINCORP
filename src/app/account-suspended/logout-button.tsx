"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function LogoutButton() {
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  }
  return (
    <Button variant="secondary" onClick={handleLogout} className="mt-6">
      Sign out
    </Button>
  );
}
