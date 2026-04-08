// Vaccine brand data by species
// Sources:
// - https://www.zoetispetcare.com/products/vanguard-dog
// - https://rabiesaware.org/usda-vaccines
// - https://jurupahillsanimalhospital.com/pet-vaccination/list-of-canine-vaccines-for-dogs/
// - https://healthtopics.vetmed.ucdavis.edu/health-topics/feline/vaccination-guidelines-dogs-and-cats

export interface VaccineInfo {
  name: string;
  brand: string;
  manufacturer: string;
  category: "core" | "non-core";
  typicalDurationMonths: number; // Typical duration until next dose
}

export const dogVaccines: VaccineInfo[] = [
  // Rabies Vaccines
  {
    name: "Nobivac 1-Rabies",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac 3-Rabies",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 36,
  },
  {
    name: "Vanguard Rabies 1 Year",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Vanguard Rabies 3 Year",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 36,
  },
  {
    name: "Imrab 3",
    brand: "Imrab",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 36,
  },
  {
    name: "Defensor 3",
    brand: "Defensor",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 36,
  },

  // Combination Vaccines (DHPP/DAPP/DA2PP)
  {
    name: "Vanguard DAPP",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Vanguard Plus 5",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Vanguard Plus 5/L4",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Canine 1-DAPPv",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Canine 1-DAPPv+L4",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Canine Spectra 5",
    brand: "Spectra",
    manufacturer: "Durvet",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Canine Spectra 6",
    brand: "Spectra",
    manufacturer: "Durvet",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Canine Spectra 9",
    brand: "Spectra",
    manufacturer: "Durvet",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Duramune Max 5",
    brand: "Duramune",
    manufacturer: "Elanco",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Duramune Max 5/4L",
    brand: "Duramune",
    manufacturer: "Elanco",
    category: "core",
    typicalDurationMonths: 12,
  },

  // Bordetella (Kennel Cough)
  {
    name: "Nobivac Canine Intra-Trac Oral Bb",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Bronchi-Shield Oral",
    brand: "Bronchi-Shield",
    manufacturer: "Elanco",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Vanguard B",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Canine Flu Bivalent",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "non-core",
    typicalDurationMonths: 12,
  },

  // Leptospirosis
  {
    name: "Nobivac Lepto4",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Vanguard L4",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "truCan L4",
    brand: "truCan",
    manufacturer: "Elanco",
    category: "core",
    typicalDurationMonths: 12,
  },

  // Lyme Disease
  {
    name: "Nobivac Lyme",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Vanguard crLyme",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Duramune Lyme",
    brand: "Duramune",
    manufacturer: "Elanco",
    category: "non-core",
    typicalDurationMonths: 12,
  },

  // Canine Influenza
  {
    name: "Vanguard CIV H3N2/H3N8",
    brand: "Vanguard",
    manufacturer: "Zoetis",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Canine Flu H3N2/H3N8",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "non-core",
    typicalDurationMonths: 12,
  },
];

export const catVaccines: VaccineInfo[] = [
  // Rabies Vaccines
  {
    name: "Purevax Feline Rabies",
    brand: "Purevax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Purevax Feline Rabies 3 Year",
    brand: "Purevax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 36,
  },
  {
    name: "Nobivac 1-Rabies (Feline)",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac 3-Rabies (Feline)",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 36,
  },
  {
    name: "Imrab 3 (Feline)",
    brand: "Imrab",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 36,
  },
  {
    name: "Defensor 3 (Feline)",
    brand: "Defensor",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 36,
  },

  // FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)
  {
    name: "Purevax Feline 3",
    brand: "Purevax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Purevax Feline 4",
    brand: "Purevax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Feline 1-HCP",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Feline 1-HCPCh",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Feline 1-HCPCh+FeLV",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Felocell 3",
    brand: "Felocell",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Felocell 4",
    brand: "Felocell",
    manufacturer: "Zoetis",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Fel-O-Vax PCT",
    brand: "Fel-O-Vax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Fel-O-Vax PCT-FeLV",
    brand: "Fel-O-Vax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Feline Focus 3",
    brand: "Focus",
    manufacturer: "Durvet",
    category: "core",
    typicalDurationMonths: 12,
  },

  // Feline Leukemia (FeLV)
  {
    name: "Purevax FeLV",
    brand: "Purevax",
    manufacturer: "Boehringer Ingelheim",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Feline 2-FeLV",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Leukocell 2",
    brand: "Leukocell",
    manufacturer: "Zoetis",
    category: "non-core",
    typicalDurationMonths: 12,
  },
  {
    name: "Fel-O-Vax Lv-K",
    brand: "Fel-O-Vax",
    manufacturer: "Boehringer Ingelheim",
    category: "non-core",
    typicalDurationMonths: 12,
  },

  // FIV (Feline Immunodeficiency Virus) - Note: Limited availability
  {
    name: "Fel-O-Vax FIV",
    brand: "Fel-O-Vax",
    manufacturer: "Boehringer Ingelheim",
    category: "non-core",
    typicalDurationMonths: 12,
  },

  // Bordetella
  {
    name: "Nobivac Feline Bb",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "non-core",
    typicalDurationMonths: 12,
  },

  // Chlamydia
  {
    name: "Felocell CVR-C",
    brand: "Felocell",
    manufacturer: "Zoetis",
    category: "non-core",
    typicalDurationMonths: 12,
  },
];

// Other pets (basic vaccines)
export const rabbitVaccines: VaccineInfo[] = [
  {
    name: "Nobivac Myxo-RHD",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac Myxo-RHD Plus",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Filavac VHD K C+V",
    brand: "Filavac",
    manufacturer: "Filavie",
    category: "core",
    typicalDurationMonths: 12,
  },
];

export const ferretVaccines: VaccineInfo[] = [
  {
    name: "Purevax Ferret Distemper",
    brand: "Purevax",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Nobivac 1-Rabies (Ferret)",
    brand: "Nobivac",
    manufacturer: "Merck Animal Health",
    category: "core",
    typicalDurationMonths: 12,
  },
  {
    name: "Imrab 3 (Ferret)",
    brand: "Imrab",
    manufacturer: "Boehringer Ingelheim",
    category: "core",
    typicalDurationMonths: 36,
  },
];

// Function to get vaccines by species
export function getVaccinesBySpecies(species: string | null): VaccineInfo[] {
  if (!species) return [];

  const normalizedSpecies = species.toLowerCase().trim();

  if (
    normalizedSpecies === "dog" ||
    normalizedSpecies.includes("dog") ||
    normalizedSpecies.includes("canine")
  ) {
    return dogVaccines;
  }
  if (
    normalizedSpecies === "cat" ||
    normalizedSpecies.includes("cat") ||
    normalizedSpecies.includes("feline")
  ) {
    return catVaccines;
  }
  if (
    normalizedSpecies === "rabbit" ||
    normalizedSpecies.includes("rabbit") ||
    normalizedSpecies.includes("bunny")
  ) {
    return rabbitVaccines;
  }
  if (normalizedSpecies === "ferret" || normalizedSpecies.includes("ferret")) {
    return ferretVaccines;
  }

  // For unknown species, return a combination of common vaccines
  return [...dogVaccines.filter((v) => v.name.toLowerCase().includes("rabies"))];
}

// Get unique vaccine names for a species (for simple dropdown)
export function getVaccineNamesBySpecies(species: string | null): string[] {
  const vaccines = getVaccinesBySpecies(species);
  return vaccines.map((v) => v.name);
}

// Get vaccine info by name
export function getVaccineInfo(name: string, species: string | null): VaccineInfo | undefined {
  const vaccines = getVaccinesBySpecies(species);
  return vaccines.find((v) => v.name === name);
}

// Core vaccine types by species for display
export interface CoreVaccineType {
  id: string;
  name: string;
  description: string;
  keywords: string[]; // Keywords to match vaccination records
}

export const dogCoreVaccineTypes: CoreVaccineType[] = [
  {
    id: "rabies",
    name: "Rabies",
    description: "Required by law in most areas",
    keywords: ["rabies", "imrab", "defensor"],
  },
  {
    id: "dhpp",
    name: "DHPP/DAPP",
    description: "Distemper, Hepatitis, Parvo, Parainfluenza",
    keywords: [
      "dhpp",
      "dapp",
      "da2pp",
      "dhlpp",
      "distemper",
      "parvo",
      "spectra",
      "duramune",
      "vanguard plus",
      "dappv",
    ],
  },
  {
    id: "lepto",
    name: "Leptospirosis",
    description: "Bacterial infection prevention",
    keywords: ["lepto", "l4", "leptospirosis"],
  },
];

export const catCoreVaccineTypes: CoreVaccineType[] = [
  {
    id: "rabies",
    name: "Rabies",
    description: "Required by law in most areas",
    keywords: ["rabies", "imrab", "defensor"],
  },
  {
    id: "fvrcp",
    name: "FVRCP",
    description: "Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia",
    keywords: [
      "fvrcp",
      "hcp",
      "feline 3",
      "feline 4",
      "felocell",
      "fel-o-vax pct",
      "panleukopenia",
      "calicivirus",
      "rhinotracheitis",
      "focus",
    ],
  },
];

export const rabbitCoreVaccineTypes: CoreVaccineType[] = [
  {
    id: "myxo-rhd",
    name: "Myxomatosis & RHD",
    description: "Myxomatosis and Rabbit Hemorrhagic Disease",
    keywords: ["myxo", "rhd", "filavac"],
  },
];

export const ferretCoreVaccineTypes: CoreVaccineType[] = [
  {
    id: "rabies",
    name: "Rabies",
    description: "Required by law in most areas",
    keywords: ["rabies", "imrab"],
  },
  {
    id: "distemper",
    name: "Distemper",
    description: "Canine distemper prevention",
    keywords: ["distemper", "purevax ferret"],
  },
];

// Get core vaccine types by species
export function getCoreVaccineTypesBySpecies(species: string | null): CoreVaccineType[] {
  if (!species) {
    // Default to dog vaccines when species is not specified
    return dogCoreVaccineTypes;
  }

  const normalizedSpecies = species.toLowerCase().trim();

  if (
    normalizedSpecies === "dog" ||
    normalizedSpecies.includes("dog") ||
    normalizedSpecies.includes("canine")
  ) {
    return dogCoreVaccineTypes;
  }
  if (
    normalizedSpecies === "cat" ||
    normalizedSpecies.includes("cat") ||
    normalizedSpecies.includes("feline")
  ) {
    return catCoreVaccineTypes;
  }
  if (
    normalizedSpecies === "rabbit" ||
    normalizedSpecies.includes("rabbit") ||
    normalizedSpecies.includes("bunny")
  ) {
    return rabbitCoreVaccineTypes;
  }
  if (normalizedSpecies === "ferret" || normalizedSpecies.includes("ferret")) {
    return ferretCoreVaccineTypes;
  }

  // Default to dog vaccines for unknown species
  return dogCoreVaccineTypes;
}

// Check if a vaccination record matches a core vaccine type
export function matchesVaccineType(vaccineName: string, vaccineType: CoreVaccineType): boolean {
  const lowerName = vaccineName.toLowerCase();
  return vaccineType.keywords.some((keyword) => lowerName.includes(keyword.toLowerCase()));
}

// Check if a vaccination is a non-core/optional vaccine
export function isOptionalVaccine(vaccineName: string, species: string | null): boolean {
  const vaccines = getVaccinesBySpecies(species);
  const vaccineInfo = vaccines.find((v) => v.name.toLowerCase() === vaccineName.toLowerCase());
  if (vaccineInfo) {
    return vaccineInfo.category === "non-core";
  }

  // Check if it matches any core vaccine type
  const coreTypes = getCoreVaccineTypesBySpecies(species);
  const matchesCore = coreTypes.some((type) => matchesVaccineType(vaccineName, type));
  return !matchesCore;
}
