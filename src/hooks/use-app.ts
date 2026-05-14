import { useContext } from "react";
import type { App } from "obsidian";
import { AppContext } from "@/context/app-context";

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) {
    throw new Error("useApp must be used within AppContext.Provider");
  }
  return app;
}
