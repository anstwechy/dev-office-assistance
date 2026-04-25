import { createTheme, rem } from "@mantine/core";
import type { AppThemePreset } from "./presets";
import { getPreset } from "./presets";
import type { AppThemeId } from "./presets";

export function buildMantineTheme(preset: AppThemePreset) {
  return createTheme({
    primaryColor: preset.mantinePrimary,
    defaultRadius: "md",
    fontFamily: '"Source Sans 3", system-ui, -apple-system, sans-serif',
    headings: {
      fontFamily: '"Fraunces", Georgia, "Times New Roman", serif',
      fontWeight: "600",
    },
    defaultGradient: preset.gradient,
    spacing: { xs: rem(8), sm: rem(12), md: rem(16), lg: rem(20), xl: rem(24) },
    components: {
      AppShell: {
        styles: {
          root: { backgroundColor: "var(--color-canvas, #fafafa)" },
          main: { backgroundColor: "var(--color-canvas, #fafafa)" },
          navbar: {
            backgroundColor: "var(--color-surface, #fff)",
            borderRight: "1px solid var(--color-border, rgba(17, 19, 24, 0.1))",
            transition: "border-color 0.45s ease, background-color 0.45s ease",
          },
        },
      },
      NavLink: {
        defaultProps: { variant: "light" },
      },
    },
  });
}

export type AppMantineTheme = ReturnType<typeof buildMantineTheme>;

export function getMantineThemeForId(id: AppThemeId) {
  return buildMantineTheme(getPreset(id));
}
