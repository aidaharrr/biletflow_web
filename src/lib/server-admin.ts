import "server-only";
import type { User } from "@/types/api";
import { backendFetch } from "./server-api";
export async function getAdminAccess(): Promise<{
  user: User | null;
  status: number;
}> {
  try {
    const response = await backendFetch("users/me");
    if (!response.ok) return { user: null, status: response.status };
    const user: User = await response.json();
    if (
      !user ||
      !Array.isArray(user.roles) ||
      !user.roles.includes("platform_admin") ||
      user.is_active === false
    )
      return { user: null, status: 403 };
    return { user, status: 200 };
  } catch {
    return { user: null, status: 502 };
  }
}
