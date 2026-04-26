import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { useAppTheme } from "./theme/AppThemeContext";

export function ThemedMantineProvider({ children }: { children: ReactNode }) {
  const { mantineTheme } = useAppTheme();
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}
