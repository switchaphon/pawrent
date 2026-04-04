// Parasite Prevention brand data by species
// Sources:
// - https://www.dutch.com/blogs/general/bravecto-vs-nexgard
// - https://hardypaw.com/blogs/news/nexgard-plus-vs-heartgard-plus
// - https://todaysveterinarypractice.com/parasitology/parasiticides-for-dogs-and-cats/
// - https://us.bravecto.com/compare-protection/

export interface ParasitePreventionInfo {
  name: string;
  brand: string;
  manufacturer: string;
  type: "flea-tick" | "heartworm" | "combination" | "all-in-one";
  species: "dog" | "cat" | "both";
  durationMonths: number; // How long the protection lasts
  description: string;
}

export const parasitePreventions: ParasitePreventionInfo[] = [
  // Dog - All-in-One (Flea, Tick, Heartworm, Intestinal)
  {
    name: "NexGard PLUS",
    brand: "NexGard",
    manufacturer: "Boehringer Ingelheim",
    type: "all-in-one",
    species: "dog",
    durationMonths: 1,
    description: "Fleas, ticks, heartworms & intestinal worms",
  },
  {
    name: "Simparica Trio",
    brand: "Simparica",
    manufacturer: "Zoetis",
    type: "all-in-one",
    species: "dog",
    durationMonths: 1,
    description: "Fleas, ticks, heartworms, roundworms & hookworms",
  },
  {
    name: "Credelio Quattro",
    brand: "Credelio",
    manufacturer: "Elanco",
    type: "all-in-one",
    species: "dog",
    durationMonths: 1,
    description: "Fleas, ticks, heartworms, roundworms, hookworms & tapeworms",
  },

  // Dog - Flea & Tick
  {
    name: "NexGard",
    brand: "NexGard",
    manufacturer: "Boehringer Ingelheim",
    type: "flea-tick",
    species: "dog",
    durationMonths: 1,
    description: "Flea & tick chewable",
  },
  {
    name: "Bravecto Chew",
    brand: "Bravecto",
    manufacturer: "Merck Animal Health",
    type: "flea-tick",
    species: "dog",
    durationMonths: 3,
    description: "12-week flea & tick protection",
  },
  {
    name: "Bravecto Quantum",
    brand: "Bravecto",
    manufacturer: "Merck Animal Health",
    type: "flea-tick",
    species: "dog",
    durationMonths: 12,
    description: "12-month injectable flea & tick protection",
  },
  {
    name: "Simparica",
    brand: "Simparica",
    manufacturer: "Zoetis",
    type: "flea-tick",
    species: "dog",
    durationMonths: 1,
    description: "Monthly flea & tick chewable",
  },
  {
    name: "Credelio",
    brand: "Credelio",
    manufacturer: "Elanco",
    type: "flea-tick",
    species: "dog",
    durationMonths: 1,
    description: "Monthly flea & tick chewable",
  },
  {
    name: "Seresto Collar (Dog)",
    brand: "Seresto",
    manufacturer: "Elanco",
    type: "flea-tick",
    species: "dog",
    durationMonths: 8,
    description: "8-month flea & tick collar",
  },
  {
    name: "Frontline Plus (Dog)",
    brand: "Frontline",
    manufacturer: "Boehringer Ingelheim",
    type: "flea-tick",
    species: "dog",
    durationMonths: 1,
    description: "Monthly topical flea & tick",
  },
  {
    name: "K9 Advantix II",
    brand: "Advantix",
    manufacturer: "Elanco",
    type: "flea-tick",
    species: "dog",
    durationMonths: 1,
    description: "Monthly topical flea, tick & mosquito",
  },

  // Dog - Heartworm
  {
    name: "Heartgard Plus",
    brand: "Heartgard",
    manufacturer: "Boehringer Ingelheim",
    type: "heartworm",
    species: "dog",
    durationMonths: 1,
    description: "Heartworm & intestinal worm prevention",
  },
  {
    name: "Interceptor Plus",
    brand: "Interceptor",
    manufacturer: "Elanco",
    type: "heartworm",
    species: "dog",
    durationMonths: 1,
    description: "Heartworm & intestinal worm prevention",
  },
  {
    name: "Sentinel Spectrum",
    brand: "Sentinel",
    manufacturer: "Merck Animal Health",
    type: "combination",
    species: "dog",
    durationMonths: 1,
    description: "Heartworm, flea & intestinal worm prevention",
  },
  {
    name: "Trifexis",
    brand: "Trifexis",
    manufacturer: "Elanco",
    type: "combination",
    species: "dog",
    durationMonths: 1,
    description: "Heartworm, flea & intestinal worm prevention",
  },
  {
    name: "ProHeart 6",
    brand: "ProHeart",
    manufacturer: "Zoetis",
    type: "heartworm",
    species: "dog",
    durationMonths: 6,
    description: "6-month injectable heartworm prevention",
  },
  {
    name: "ProHeart 12",
    brand: "ProHeart",
    manufacturer: "Zoetis",
    type: "heartworm",
    species: "dog",
    durationMonths: 12,
    description: "12-month injectable heartworm prevention",
  },

  // Cat - All-in-One
  {
    name: "NexGard COMBO (Cat)",
    brand: "NexGard",
    manufacturer: "Boehringer Ingelheim",
    type: "all-in-one",
    species: "cat",
    durationMonths: 1,
    description: "Fleas, ticks, heartworms, intestinal worms & tapeworms",
  },
  {
    name: "Revolution Plus",
    brand: "Revolution",
    manufacturer: "Zoetis",
    type: "all-in-one",
    species: "cat",
    durationMonths: 1,
    description: "Fleas, ticks, heartworms, ear mites & intestinal worms",
  },

  // Cat - Flea & Tick
  {
    name: "Bravecto Topical (Cat)",
    brand: "Bravecto",
    manufacturer: "Merck Animal Health",
    type: "flea-tick",
    species: "cat",
    durationMonths: 3,
    description: "12-week topical flea & tick protection",
  },
  {
    name: "Seresto Collar (Cat)",
    brand: "Seresto",
    manufacturer: "Elanco",
    type: "flea-tick",
    species: "cat",
    durationMonths: 8,
    description: "8-month flea & tick collar",
  },
  {
    name: "Frontline Plus (Cat)",
    brand: "Frontline",
    manufacturer: "Boehringer Ingelheim",
    type: "flea-tick",
    species: "cat",
    durationMonths: 1,
    description: "Monthly topical flea & tick",
  },
  {
    name: "Advantage II (Cat)",
    brand: "Advantage",
    manufacturer: "Elanco",
    type: "flea-tick",
    species: "cat",
    durationMonths: 1,
    description: "Monthly topical flea prevention",
  },
  {
    name: "Credelio Cat",
    brand: "Credelio",
    manufacturer: "Elanco",
    type: "flea-tick",
    species: "cat",
    durationMonths: 1,
    description: "Monthly flea & tick chewable for cats",
  },

  // Cat - Heartworm
  {
    name: "Heartgard (Cat)",
    brand: "Heartgard",
    manufacturer: "Boehringer Ingelheim",
    type: "heartworm",
    species: "cat",
    durationMonths: 1,
    description: "Heartworm & hookworm prevention",
  },
  {
    name: "Revolution (Cat)",
    brand: "Revolution",
    manufacturer: "Zoetis",
    type: "heartworm",
    species: "cat",
    durationMonths: 1,
    description: "Heartworm, flea & ear mite prevention",
  },
];

// Get parasite preventions by species
export function getParasitePreventionsBySpecies(species: string | null): ParasitePreventionInfo[] {
  if (!species) {
    // Default to dog products
    return parasitePreventions.filter(p => p.species === "dog" || p.species === "both");
  }

  const normalizedSpecies = species.toLowerCase().trim();

  if (normalizedSpecies === "dog" || normalizedSpecies.includes("dog") || normalizedSpecies.includes("canine")) {
    return parasitePreventions.filter(p => p.species === "dog" || p.species === "both");
  }
  if (normalizedSpecies === "cat" || normalizedSpecies.includes("cat") || normalizedSpecies.includes("feline")) {
    return parasitePreventions.filter(p => p.species === "cat" || p.species === "both");
  }

  // Default to dog products for unknown species
  return parasitePreventions.filter(p => p.species === "dog" || p.species === "both");
}

// Get product names for dropdown
export function getParasitePreventionNames(species: string | null): string[] {
  const products = getParasitePreventionsBySpecies(species);
  return products.map(p => p.name);
}

// Get product info by name
export function getParasitePreventionInfo(name: string): ParasitePreventionInfo | undefined {
  return parasitePreventions.find(p => p.name === name);
}
