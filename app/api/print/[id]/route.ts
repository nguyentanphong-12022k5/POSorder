import { NextRequest, NextResponse } from "next/server";
import { POST as orderPrintPost } from "@/app/api/orders/[id]/print/route";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  // Delegate tới /api/orders/[id]/print để nhất quán
  return orderPrintPost(req, context);
}
