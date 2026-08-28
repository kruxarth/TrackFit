export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  danger: string;
  success: string;
};

export const darkColors: ColorTokens = {
  bg: "#0E1113",
  surface: "#171B1E",
  surfaceRaised: "#1F2428",
  border: "#262C30",
  textPrimary: "#F2F4F5",
  textSecondary: "#9AA3A9",
  textDisabled: "#5A6268",
  accent: "#C8F542",
  accentPressed: "#B2DE33",
  onAccent: "#131807",
  danger: "#F26D6D",
  success: "#58C776",
};

export const lightColors: ColorTokens = {
  bg: "#F7F6F3",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#E6E4DE",
  textPrimary: "#16191B",
  textSecondary: "#5D666C",
  textDisabled: "#A8ADB2",
  accent: "#5F7D0C",
  accentPressed: "#4E680A",
  onAccent: "#FFFFFF",
  danger: "#C94040",
  success: "#2E8B4F",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const spacingScale = [4, 8, 12, 16, 20, 24, 32] as const;

export const radii = {
  card: 14,
  button: 12,
  input: 10,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: "700" as const, lineHeight: 38 },
  title: { fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: "600" as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  numeral: {
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 28,
    fontVariant: ["tabular-nums"] as unknown as string[],
  },
} as const;

export type Theme = {
  colors: ColorTokens;
  spacing: typeof spacing;
  spacingScale: typeof spacingScale;
  radii: typeof radii;
  typography: typeof typography;
  isDark: boolean;
};

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  spacingScale,
  radii,
  typography,
  isDark: false,
};

export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  spacingScale,
  radii,
  typography,
  isDark: true,
};
