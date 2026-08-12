import {
  authenticationMutationGuard,
  clearedSessionResponse,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  const rejected = authenticationMutationGuard(request);
  if (rejected) return rejected;
  return clearedSessionResponse("admin");
}
