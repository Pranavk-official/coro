"use client";
import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@heroui/react";
import { createQueryClient } from "@/lib/react-query/client";
import { toastQueue } from "@/lib/toast";

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        {children}
        {/* ToastProvider is the toast region; its children prop renders each toast, not the app */}
        <ToastProvider queue={toastQueue} placement="top" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
