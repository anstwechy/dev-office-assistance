import { Navigate, useParams } from "react-router-dom";

/** Bookmarks resolve to the planning screen with the edit dialog open. */
export function PlanningEditPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/planning" replace />;
  }
  return <Navigate to={{ pathname: "/planning", search: new URLSearchParams({ edit: id }).toString() }} replace />;
}
