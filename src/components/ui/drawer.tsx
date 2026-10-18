"use client";
/**
 * shadcn/ui Drawer, base-maia style (Base UI), trimmed to the parts we use. Fallback for a primitive HeroUI lacks:
 * stacked bottom sheets — a `Drawer` rendered inside another drawer's content stacks on it (parent scales back
 * and peeks above). Callers add the surface (`glass`), so background/border aren't set here (no class merging).
 * Source: https://ui.shadcn.com/r/styles/base-maia/drawer.json
 */
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Drawer({ swipeDirection = "down", ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" swipeDirection={swipeDirection} {...props} />;
}

function DrawerSwipeHandle() {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className="relative z-10 flex h-3 w-full shrink-0 cursor-grab items-end justify-center transition-opacity duration-200 group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 after:block after:h-1.5 after:w-[100px] after:shrink-0 after:rounded-full after:bg-white/30 active:cursor-grabbing"
    />
  );
}

function DrawerContent({ className, children, ...props }: Omit<DrawerPrimitive.Popup.Props, "className"> & { className?: string }) {
  return (
    <DrawerPrimitive.Portal>
      {/* Lighter than maia's black/80: the call should stay readable behind the sheet. */}
      <DrawerPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black/40 opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-backdrop-filter:backdrop-blur-xs supports-[-webkit-touch-callout:none]:absolute"
      />
      <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="pointer-events-auto fixed inset-0 z-50 select-none">
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis="y"
          className={cx(
            // Base.
            "group/drawer-popup pointer-events-auto fixed z-50 m-(--drawer-inset,0px) flex h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col rounded-4xl text-sm text-foreground transition-[transform,height,opacity,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform outline-none select-none [--drawer-bleed-background:transparent] [--drawer-inset:--spacing(2)] [interpolate-size:allow-keywords]",
            // Nested.
            "data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95",
            // Sizing.
            "[--drawer-content-height:var(--drawer-height,auto)] [--drawer-content-max-height:calc(100dvh-6rem)]",
            // Stack.
            "[--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]",
            // Transitions.
            "data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-swiping:duration-0 data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:transform-(--closed-transform) data-swiping:duration-0 data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            // Bottom sheet (swipe down to close).
            "inset-x-0 bottom-0 origin-bottom data-nested-drawer-open:h-(--stack-height) [--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] [--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]",
            className,
          )}
          {...props}
        >
          <DrawerSwipeHandle />
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-[cubic-bezier(0.45,1.005,0,1.005)] select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none"
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

function DrawerTitle({ className, ...props }: Omit<DrawerPrimitive.Title.Props, "className"> & { className?: string }) {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={cx("font-semibold text-foreground", className)} {...props} />;
}

export { Drawer, DrawerContent, DrawerTitle };
