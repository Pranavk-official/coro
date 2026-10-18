"use client";
/**
 * shadcn/ui Drawer (vaul), trimmed to the parts we use. Fallback for a primitive HeroUI lacks: stacked
 * bottom sheets — `DrawerNested` inside a `Drawer` scales the parent back and slides over it.
 * Transparent overlay (the call stays visible); callers add the surface (`glass`).
 */
import type { ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

function Drawer(props: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerNested(props: ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return <DrawerPrimitive.NestedRoot data-slot="drawer" {...props} />;
}

function DrawerContent({ className = "", children, ...props }: ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay data-slot="drawer-overlay" className="fixed inset-0 z-50 bg-transparent" />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        aria-describedby={undefined}
        className={`fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[80vh] flex-col rounded-t-[28px] outline-none ${className}`}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/30" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function DrawerTitle({ className = "", ...props }: ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={`font-semibold ${className}`} {...props} />;
}

export { Drawer, DrawerNested, DrawerContent, DrawerTitle };
