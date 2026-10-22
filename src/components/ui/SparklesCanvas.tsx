"use client";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import type { Container, Engine, ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";

/** Module-level and stable: ParticlesProvider throws if its init callback changes between renders. */
const init = async (engine: Engine) => {
  await loadSlim(engine);
};

/** The tsParticles half of `Sparkles`, split out so its ~80 KB loads only when the sparkles start. */
export default function SparklesCanvas({
  id,
  options,
  onLoaded,
}: {
  id: string;
  options: ISourceOptions;
  onLoaded: (c?: Container) => Promise<void>;
}) {
  return (
    <ParticlesProvider init={init}>
      <Particles id={id} options={options} className="h-full w-full" particlesLoaded={onLoaded} />
    </ParticlesProvider>
  );
}
