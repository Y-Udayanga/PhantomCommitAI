import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticated } from "@/lib/server/supabase";
import { applicationOrigin } from "@/lib/server/origin";
import {
  githubAppConfigured,
  githubCookieOptions,
  githubSessionCookie,
  githubStateCookie,
  readGitHubSession,
} from "@/lib/server/github-app";

export async function GET() {
  try {
    const { user } = await authenticated();
    const session = readGitHubSession(
      (await cookies()).get(githubSessionCookie)?.value,
      user.id,
    );
    return NextResponse.json(
      {
        data: {
          configured: githubAppConfigured(),
          connected: !!session,
          login: session?.login,
          expires_at: session
            ? new Date(session.expiresAt).toISOString()
            : undefined,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: { message: "Sign in to manage your GitHub connection." } },
      { status: 401 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  const origin = applicationOrigin(request.url);
  if (request.headers.get("origin") !== origin)
    return NextResponse.json(
      { error: { message: "Request origin is not allowed." } },
      { status: 403 },
    );
  try {
    await authenticated();
    const response = NextResponse.json(
      { data: { disconnected: true } },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      githubSessionCookie,
      "",
      githubCookieOptions(origin, 0),
    );
    response.cookies.set(githubStateCookie, "", githubCookieOptions(origin, 0));
    return response;
  } catch {
    return NextResponse.json(
      { error: { message: "Sign in to manage your GitHub connection." } },
      { status: 401 },
    );
  }
}
