"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in srgb, var(--success) 12%, var(--popover))",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "color-mix(in srgb, var(--success) 42%, var(--border))",
          "--warning-bg": "color-mix(in srgb, var(--warning) 14%, var(--popover))",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "color-mix(in srgb, var(--warning) 45%, var(--border))",
          "--error-bg": "color-mix(in srgb, var(--danger) 12%, var(--popover))",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "color-mix(in srgb, var(--danger) 45%, var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
