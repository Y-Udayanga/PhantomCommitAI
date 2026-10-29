import { NextRequest, NextResponse } from "next/server";
import { authenticated } from "@/lib/server/supabase";
import { applicationOrigin } from "@/lib/server/origin";
import {
  githubCookieOptions,
  githubStateCookie,
  newGitHubAuthorization,
} from "@/lib/server/github-app";

export async function GET(request: NextRequest) {
  const origin = applicationOrigin(request.url);
  try {
    const { user } = await authenticated();
    const auth = newGitHubAuthorization(user.id, origin);
    const response = NextResponse.redirect(auth.url);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(
      githubStateCookie,
      auth.cookie,
      githubCookieOptions(origin, 600),
    );
    return response;
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        error instanceof Error && error.message === "UNAUTHORIZED"
          ? "/auth"
          : "/settings?github=error",
        origin,
      ),
    );
  }
}
