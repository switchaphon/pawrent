"use client";

import { useEffect } from "react";

export function DebugConsole() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("vconsole").then(({ default: VConsole }) => {
        new VConsole();
      });
    }
  }, []);

  return null;
}
