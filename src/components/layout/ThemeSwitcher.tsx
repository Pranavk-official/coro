"use client";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Monitor, Moon, Sun } from "lucide-react";

const OPTIONS = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
] as const;

const noop = () => () => {};
/** Theme is only known on the client; render nothing on the server to avoid a hydration mismatch. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * Light / dark / system rail: one pill springs to the hovered option and rests on the selected one.
 * `collapsed`: a one-slot dock showing the current theme that glides open on hover/focus (tap on touch).
 */
export default function ThemeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { theme = "system", setTheme } = useTheme();
  if (!useMounted()) return <div className="size-11" />;
  const rail = (
    <ToggleButtonGroup
      aria-label="Theme"
      isDetached
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[theme]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next) setTheme(String(next));
      }}
      className={`theme-rail w-max flex-none gap-1 rounded-full p-1 ${collapsed ? "" : "glass"}`}
    >
      {OPTIONS.map(({ id, label, Icon }) => (
        <ToggleButton
          key={id}
          id={id}
          isIconOnly
          variant="ghost"
          aria-label={label}
          className="size-9 rounded-full bg-transparent text-muted hover:bg-transparent data-[hovered=true]:bg-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground"
        >
          <Icon size={18} aria-hidden />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
  return collapsed ? <div className="theme-dock glass flex rounded-full">{rail}</div> : rail;
}

/** Pages that render AppHeader, which already carries the theme rail. */
const WITH_HEADER = new Set(["/", "/profile", "/privacy", "/terms"]);

/** Floating top-right badge on every page without the app header. */
export function ThemeBadge() {
  const path = usePathname();
  if (WITH_HEADER.has(path)) return null;
  return (
    <div className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-50">
      <ThemeSwitcher collapsed />
    </div>
  );
}
