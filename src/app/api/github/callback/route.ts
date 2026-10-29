import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticated } from "@/lib/server/supabase";
import { applicationOrigin } from "@/lib/server/origin";
import { github } from "@/lib/server/github";
import {
  exchangeGitHubCode,
  githubCookieOptions,
  githubSessionCookie,
  githubStateCookie,
  sealGitHubCookie,
  validateGitHubState,
} from "@/lib/server/github-app";

export async function GET(request: NextRequest) {
  const origin = applicationOrigin(request.url);
  try {
    const { user } = await authenticated();
    const code = request.nextUrl.searchParams.get("code") || "",
      state = request.nextUrl.searchParams.get("state") || "";
    if (
      !code ||
      code.length > 512 ||
      state.length > 200 ||
      request.nextUrl.searchParams.has("error")
    )
      throw new Error("Invalid callback");
    const verifier = validateGitHubState(
      (await cookies()).get(githubStateCookie)?.value,
      state,
      user.id,
    );
    const credential = await exchangeGitHubCode(code, verifier, origin);
    const { data: profile } = await github("/user", {
      token: credential.token,
    });
    if (typeof profile.login !== "string" || profile.login.length > 100)
      throw new Error("Invalid profile");
    const response = NextResponse.redirect(
      new URL("/settings?github=connected", origin),
    );
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(githubStateCookie, "", githubCookieOptions(origin, 0));
    response.cookies.set(
      githubSessionCookie,
      sealGitHubCookie(
        { owner: user.id, login: profile.login, ...credential },
        "session",
      ),
      githubCookieOptions(
        origin,
        Math.max(1, Math.floor((credential.expiresAt - Date.now()) / 1000)),
      ),
    );
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/settings?github=error", origin),
    );
    response.cookies.set(githubStateCookie, "", githubCookieOptions(origin, 0));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
