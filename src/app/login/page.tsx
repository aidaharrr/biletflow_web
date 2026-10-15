import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
