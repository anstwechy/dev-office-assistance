import { Navigate, useParams } from "react-router-dom";

/**
 * Full-page route kept for bookmarks; editing happens on the list with a dialog.
 */
export function ExpenseEditPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/expenses" replace />;
  }
  return <Navigate to={{ pathname: "/expenses", search: new URLSearchParams({ edit: id }).toString() }} replace />;
}
