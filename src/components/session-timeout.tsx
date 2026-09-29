"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  SESSION_TIMEOUT_MS,
  evaluateState,
  shouldTrackActivity,
  computeNextDelay,
  resolveVisibilityAction,
  SESSION_TIMEOUT_CHANNEL,
  type SessionTimeoutMessage,
} from "@/lib/session-timeout";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function SessionTimeout() {
  const router = useRouter();
  const actionsRef = useRef<{ continueSession: () => void } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastActivity = Date.now();
    let warned = false;
    let loggedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const canBroadcast = typeof BroadcastChannel !== "undefined";
    const channel = canBroadcast ? new BroadcastChannel(SESSION_TIMEOUT_CHANNEL) : null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const performLogout = async (skipServerCall: boolean) => {
      if (loggedOut) return;
      loggedOut = true;
      clearTimer();
      channel?.postMessage({ type: "logout" });
      try {
        if (!skipServerCall) {
          await fetch("/api/auth/logout", { method: "POST" });
        }
      } catch {
        // Ignore network errors; the server cookie is cleared by the redirect guard.
      }
      router.push("/login");
      router.refresh();
    };

    const schedule = () => {
      clearTimer();
      const step = () => {
        if (loggedOut) return;
        const now = Date.now();
        const state = evaluateState(now, lastActivity);
        if (state === "expired") {
          void performLogout(false);
          return;
        }
        if (state === "warning") {
          const leftSec = Math.max(0, Math.ceil((lastActivity + SESSION_TIMEOUT_MS - now) / 1000));
          if (!warned) {
            warned = true;
            setSecondsLeft(leftSec);
          } else {
            setSecondsLeft((prev) => (prev === leftSec ? prev : leftSec));
          }
        } else if (warned) {
          warned = false;
          setSecondsLeft(null);
        }
        const delay = computeNextDelay(warned, now, lastActivity);
        timer = setTimeout(step, delay);
      };
      timer = setTimeout(step, 0);
    };

    const recordActivity = (broadcast: boolean) => {
      const now = Date.now();
      if (!shouldTrackActivity(now, lastActivity)) return;
      lastActivity = now;
      if (broadcast) channel?.postMessage({ type: "activity", at: now });
      if (warned) {
        warned = false;
        setSecondsLeft(null);
      }
      schedule();
    };

    const continueSession = () => {
      lastActivity = Date.now();
      if (warned) {
        warned = false;
        setSecondsLeft(null);
      }
      channel?.postMessage({ type: "activity", at: lastActivity });
      schedule();
    };

    actionsRef.current = { continueSession };

    const onActivity = () => recordActivity(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (resolveVisibilityAction(Date.now(), lastActivity) === "logout") {
          void performLogout(false);
          return;
        }
        recordActivity(true);
      }
    };
    const onMessage = (event: MessageEvent<SessionTimeoutMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "activity") {
        recordActivity(false);
      } else if (msg.type === "logout") {
        void performLogout(true);
      }
    };

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    if (channel) channel.onmessage = onMessage;

    schedule();

    return () => {
      clearTimer();
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
      actionsRef.current = null;
    };
  }, [router]);

  if (secondsLeft === null) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-zinc-900">Session Timeout</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Auto logout in {secondsLeft} second{secondsLeft === 1 ? "" : "s"}</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-sm text-zinc-700">
            You have been inactive. You will be logged out due to inactivity unless you continue your session.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => actionsRef.current?.continueSession()}>Continue Session</Button>
          </div>
        </div>
      </div>
    </div>
  );
}