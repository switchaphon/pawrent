"use client";

import { useEffect } from "react";

export function DebugConsole() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("vconsole").then(({ default: VConsole }) => {
        new VConsole();
      });
    }
  }, []);

  return null;
}
