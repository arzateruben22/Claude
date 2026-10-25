import type { CreationKey, CreationMeta } from "./types";

export const CREATIONS: Record<CreationKey, CreationMeta> = {
  glass_garden: {
    name: "The Glass Garden",
    topic: "skincare",
    forms: ["Dewdrop", "Crystal Sprout", "Glass Terrarium", "Floating Conservatory", "Luminous Sanctuary"],
    branches: {
      a: { name: "Botanical bloom", blurb: "Soft petals, arching leaves and blossoms that open in water-light." },
      b: { name: "Geometric crystal architecture", blurb: "Faceted glass, rose-quartz spires and clean architectural lines." },
    },
    colors: { primary: "#C98088", secondary: "#E3CBA4", glow: "#F2BDB6" },
  },
  gravity_marble: {
    name: "The Gravity Marble",
    topic: "physics",
    forms: ["Glass Marble", "Orbital Core", "Kinetic Engine", "Gravity Forge", "Reality Engine"],
    branches: {
      a: { name: "Orbital machinery", blurb: "Gimbals, gear rings and satellites locked in precise, interlocking orbits." },
      b: { name: "Luminous field patterns", blurb: "Glowing field lines and interference rings that trace invisible forces." },
    },
    colors: { primary: "#2F6BFF", secondary: "#9AA6B8", glow: "#7FB0FF" },
  },
  bioelectric_car: {
    name: "The Bioelectric Car",
    topic: "body",
    forms: ["Rolling Chassis", "Electric Coupe", "Performance Machine", "Hypercar", "Apex Bioelectric Prototype"],
    branches: {
      a: { name: "Aerodynamic sprint prototype", blurb: "Low, light and sharp: a sprinter built for explosive bursts of power." },
      b: { name: "Long-distance endurance machine", blurb: "Long-tailed and steady: a machine of stamina built to go the distance." },
    },
    colors: { primary: "#F2604F", secondary: "#3A3431", glow: "#FF9E8A" },
  },
  pocket_universe: {
    name: "The Pocket Universe",
    topic: "space",
    forms: ["Cosmic Spark", "Young Star", "Planetary System", "Spiral Galaxy", "Living Cosmos"],
    branches: {
      a: { name: "Spiral-galaxy landscape", blurb: "A tiny crystal world beneath the turning wheel of a spiral galaxy." },
      b: { name: "Nebula observatory", blurb: "An observatory moon keeping watch over glowing nebula clouds." },
    },
    colors: { primary: "#5B3CC4", secondary: "#5FD8EA", glow: "#A994FF" },
  },
  rift_dragon: {
    name: "The Rift Dragon",
    topic: "whatif",
    forms: ["Mysterious Egg", "Neon Hatchling", "Rift Drake", "Astral Dragon", "Cosmic Sovereign"],
    branches: {
      a: { name: "Storm-and-plasma dragon", blurb: "Forked horns and crackling plasma, born of the rift's storms." },
      b: { name: "Crystalline portal dragon", blurb: "Amber crystal plates and faceted portals that fold space into gems." },
    },
    colors: { primary: "#F0A03A", secondary: "#E0562F", glow: "#FFC56B" },
  },
};
