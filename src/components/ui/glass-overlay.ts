/**
 * Liquid-glass + kinematic motion for HeroUI Modal / AlertDialog parts, as className (HeroUI docs "Custom
 * Animations": data-[entering]/data-[exiting] utilities on Backdrop + Container). Shared by SignInModal and
 * the sign-out confirm. Tokens only (006 R1); `!` beats the unlayered glass surface rules in globals.css.
 */

/** Light tint so the page shows through the glass; blur ramps in with the fade. */
export const glassBackdrop = [
  "bg-black/20 dark:bg-black/45",
  "data-[entering]:duration-400 data-[entering]:ease-[cubic-bezier(0.16,1,0.3,1)]",
  "data-[exiting]:duration-200 data-[exiting]:ease-[cubic-bezier(0.7,0,0.84,0)]",
].join(" ");

/** Kinematic scale: fast spring in, quick ease out. Transitions stay off `all` (see globals "Overlay close fix"). */
export const glassContainer = [
  "transition-[opacity,transform]",
  "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[entering]:slide-in-from-bottom-2",
  "data-[entering]:duration-400 data-[entering]:ease-[cubic-bezier(0.16,1,0.3,1)]",
  "data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95",
  "data-[exiting]:duration-200 data-[exiting]:ease-[cubic-bezier(0.7,0,0.84,0)]",
].join(" ");

/** Translucent pane: heavy blur + saturation, top highlight, hairline rim, soft drop shadow. */
export const glassDialog = [
  "bg-glass! backdrop-blur-2xl! backdrop-saturate-200!",
  "border! border-white/25! dark:border-white/12!",
  "shadow-[inset_0_1px_0_var(--glass-highlight),0_24px_80px_rgb(0_0_0/0.28)]!",
  "rounded-[28px]!",
].join(" ");
