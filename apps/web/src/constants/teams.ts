import type { DevTeam } from "@office/types";

export const DEV_TEAM_LABELS: Record<DevTeam, string> = {
  backend: "Backend",
  qa: "QA",
  frontend_web: "Frontend (Web)",
  frontend_mobile: "Frontend (Mobile)",
};

export const DEV_TEAMS_ORDER: DevTeam[] = [
  "backend",
  "qa",
  "frontend_web",
  "frontend_mobile",
];
