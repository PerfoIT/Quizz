import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken } from "../lib/api";

export function ProtectedRoute({ children }: PropsWithChildren) {
  if (!getAuthToken()) return <Navigate to="/login" replace />;
  return children;
}
