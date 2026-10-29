export function GET() {
  return Response.json(
    { status: "ok", service: "phantomcommit-ai" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
