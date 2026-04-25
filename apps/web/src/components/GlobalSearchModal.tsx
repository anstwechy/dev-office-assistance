import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActionIcon, Box, Group, Loader, Modal, Text, TextInput, Stack, ScrollArea } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { SearchResponseDto } from "@office/types";
import { useApi } from "../useApi";

export function GlobalSearchTrigger() {
  const [open, { open: onOpen, close: onClose }] = useDisclosure(false);
  const { request } = useApi();
  const [q, setQ] = useState("");
  const [debounced] = useDebouncedValue(q.trim(), 220);
  const minQuery = debounced.length >= 2;

  const searchQuery = useQuery({
    queryKey: ["search", debounced],
    queryFn: async () => {
      const res = await request(`/api/search?q=${encodeURIComponent(debounced)}`);
      if (!res.ok) throw new Error("search_failed");
      return (await res.json()) as SearchResponseDto;
    },
    enabled: open && minQuery,
  });

  useEffect(() => {
    if (!open) {
      setQ("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpen, open]);

  const data = searchQuery.data;
  const total =
    (data?.triage.length ?? 0) +
    (data?.planning.length ?? 0) +
    (data?.developers.length ?? 0) +
    (data?.decisions.length ?? 0);

  return (
    <>
      <ActionIcon
        type="button"
        variant="default"
        size="lg"
        radius="md"
        onClick={onOpen}
        title="Search (Ctrl+K)"
        aria-label="Open search"
      >
        <IconSearch size={20} stroke={1.5} />
      </ActionIcon>
      <Modal
        opened={open}
        onClose={onClose}
        title="Search workspace"
        size="lg"
        padding="md"
        zIndex={400}
        styles={{ body: { paddingTop: 0 } }}
      >
        <TextInput
          autoFocus
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search triage, planning, people, decisions…"
          leftSection={<IconSearch size={18} stroke={1.5} />}
          aria-label="Search query"
        />
        <Text size="xs" c="dimmed" mt="xs" mb="sm">
          Type at least 2 characters. Keyboard shortcut: Ctrl+K or Cmd+K.
        </Text>
        {!minQuery && (
          <Text size="sm" c="dimmed">
            Keep typing to see matches.
          </Text>
        )}
        {minQuery && searchQuery.isLoading && (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        )}
        {minQuery && searchQuery.isError && (
          <Text size="sm" c="red" role="alert">
            Search failed. Check your connection and try again.
          </Text>
        )}
        {minQuery && data && (
          <ScrollArea h={360} type="auto" offsetScrollbars>
            <Stack gap="lg" pr="xs">
              {total === 0 && (
                <Text size="sm" c="dimmed">
                  No results for &quot;{data.q}&quot;.
                </Text>
              )}
              {data.triage.length > 0 && (
                <Box>
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
                    Triage
                  </Text>
                  <Stack gap={6}>
                    {data.triage.map((r) => (
                      <Text key={r.id} size="sm" component="div" style={{ lineHeight: 1.35 }}>
                        <Link
                          to={`/triage/${r.id}`}
                          onClick={onClose}
                          className="search-hit-link"
                        >
                          {r.title}
                        </Link>
                        <Text span size="xs" c="dimmed" display="block">
                          {r.category} · {r.status}
                        </Text>
                      </Text>
                    ))}
                  </Stack>
                </Box>
              )}
              {data.planning.length > 0 && (
                <Box>
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
                    Planning
                  </Text>
                  <Stack gap={6}>
                    {data.planning.map((r) => (
                      <Text key={r.id} size="sm" component="div">
                        <Link
                          to={{ pathname: "/planning", search: new URLSearchParams({ edit: r.id }).toString() }}
                          onClick={onClose}
                          className="search-hit-link"
                        >
                          {r.title}
                        </Link>
                        <Text span size="xs" c="dimmed" display="block">
                          {r.status}
                        </Text>
                      </Text>
                    ))}
                  </Stack>
                </Box>
              )}
              {data.developers.length > 0 && (
                <Box>
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
                    Developers
                  </Text>
                  <Stack gap={6}>
                    {data.developers.map((r) => (
                      <Text key={r.id} size="sm" component="div">
                        <Link to={`/developers/${r.id}`} onClick={onClose} className="search-hit-link">
                          {r.displayName}
                        </Link>
                        {r.skills && (
                          <Text span size="xs" c="dimmed" display="block" lineClamp={2}>
                            {r.skills}
                          </Text>
                        )}
                      </Text>
                    ))}
                  </Stack>
                </Box>
              )}
              {data.decisions.length > 0 && (
                <Box>
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
                    Decisions
                  </Text>
                  <Stack gap={6}>
                    {data.decisions.map((r) => (
                      <Text key={r.id} size="sm" component="div">
                        <Link to={`/decisions#${r.id}`} onClick={onClose} className="search-hit-link">
                          {r.title}
                        </Link>
                        <Text span size="xs" c="dimmed" display="block">
                          {r.decidedOn}
                        </Text>
                      </Text>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </ScrollArea>
        )}
      </Modal>
    </>
  );
}
