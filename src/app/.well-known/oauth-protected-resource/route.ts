import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../env";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  
  return NextResponse.json({
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [env.WORKOS_AUTHKIT_DOMAIN],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile", "email"], // todo: might not need these
  }, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*", // todo: might want to restrict this in the future
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // todo: might want to restrict this in the future
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}