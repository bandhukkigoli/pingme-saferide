"use client";
// A tiny toast: a message that floats at the bottom for a few seconds.
// useToast() gives you { toast, show }. Render {toast} once in your page, call show("text", "ok" | "err").
import { useCallback, useRef, useState } from "react";

export function useToast(ms = 2500) {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string, kind: "ok" | "err" = "ok") => {
      setMsg({ text, kind });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), ms);
    },
    [ms]
  );

  const toast = msg ? (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 16,
        zIndex: 2000,
        maxWidth: 420,
        margin: "0 auto",
        padding: "12px 14px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        color: "#fff",
        background: msg.kind === "err" ? "#A32D2D" : "#0F6E56",
        boxShadow: "0 4px 14px rgba(0,0,0,.25)",
        animation: "pop .15s ease-out",
      }}
    >
      {msg.text}
    </div>
  ) : null;

  return { toast, show };
}
