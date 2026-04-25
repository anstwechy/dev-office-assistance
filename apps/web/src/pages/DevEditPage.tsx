import { Navigate, useParams } from "react-router-dom";

export function DevEditPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/developers" replace />;
  }
  return <Navigate to={{ pathname: "/developers", search: new URLSearchParams({ edit: id }).toString() }} replace />;
}
