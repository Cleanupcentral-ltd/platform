export const LONDON_BOROUGHS = [
  "Barking and Dagenham",
  "Barnet",
  "Bexley",
  "Brent",
  "Bromley",
  "Camden",
  "City of London",
  "Croydon",
  "Ealing",
  "Enfield",
  "Greenwich",
  "Hackney",
  "Hammersmith and Fulham",
  "Haringey",
  "Harrow",
  "Havering",
  "Hillingdon",
  "Hounslow",
  "Islington",
  "Kensington and Chelsea",
  "Kingston upon Thames",
  "Lambeth",
  "Lewisham",
  "Merton",
  "Newham",
  "Redbridge",
  "Richmond upon Thames",
  "Southwark",
  "Sutton",
  "Tower Hamlets",
  "Waltham Forest",
  "Wandsworth",
  "Westminster",
] as const;

export type LondonBorough =
  (typeof LONDON_BOROUGHS)[number];

function normalized(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(
      /^(?:the\s+)?(?:royal\s+)?london\s+borough\s+of\s+/,
      "",
    )
    .replace(/\s+/g, " ");
}

const BOROUGH_BY_NORMALIZED =
  new Map<string, LondonBorough>(
    LONDON_BOROUGHS.map(
      (borough) => [
        normalized(borough),
        borough,
      ],
    ),
  );

export function canonicalLondonBorough(
  value: string,
): LondonBorough | null {
  return (
    BOROUGH_BY_NORMALIZED.get(
      normalized(value),
    ) ?? null
  );
}
