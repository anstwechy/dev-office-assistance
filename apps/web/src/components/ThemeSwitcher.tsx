import { Group, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useAppTheme } from "../theme/AppThemeContext";
import { THEME_PRESETS, type AppThemeId } from "../theme/presets";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId, preset } = useAppTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="Color theme">
      {!compact && (
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" className="theme-switcher__label">
          Theme
        </Text>
      )}
      <Group gap={6} wrap="nowrap" className="theme-switcher__swatches">
        {THEME_PRESETS.map((p) => {
          const active = p.id === themeId;
          return (
            <Tooltip
              key={p.id}
              label={
                <span>
                  <strong>{p.label}</strong> — {p.description}
                </span>
              }
              position="bottom"
              withArrow
            >
              <UnstyledButton
                type="button"
                onClick={() => setThemeId(p.id as AppThemeId)}
                className={`theme-swatch${active ? " theme-swatch--active" : ""}`}
                style={{ background: p.swatch }}
                aria-pressed={active}
                aria-label={`${p.label} theme. ${p.description}`}
              />
            </Tooltip>
          );
        })}
      </Group>
      {!compact && (
        <Text size="xs" c="dimmed" className="theme-switcher__current" data-active-theme={themeId}>
          {preset.shortLabel}
        </Text>
      )}
    </div>
  );
}
