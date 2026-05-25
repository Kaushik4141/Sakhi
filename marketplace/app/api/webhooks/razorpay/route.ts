import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type RazorpayWebhookBody = {
  productId: number;
  productName: string;
  amount: number;
  paymentId: string;
  orderId: string | null;
  signature: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body: RazorpayWebhookBody = await request.json();

    // ── Log the successful order ────────────────────────────────
    console.log("═══════════════════════════════════════════════════");
    console.log("🛒 NEW ORDER RECEIVED");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Product ID   : ${body.productId}`);
    console.log(`  Product Name : ${body.productName}`);
    console.log(`  Amount (INR) : ₹${body.amount}`);
    console.log(`  Payment ID   : ${body.paymentId}`);
    console.log(`  Order ID     : ${body.orderId ?? "N/A (test mode)"}`);
    console.log(`  Signature    : ${body.signature ?? "N/A (test mode)"}`);
    console.log(`  Timestamp    : ${new Date().toISOString()}`);
    console.log("═══════════════════════════════════════════════════");

    // TODO: In production, verify the Razorpay signature here using
    // crypto.subtle.sign() and your Razorpay webhook secret.

    // TODO: Insert order into D1 database.

    return NextResponse.json(
      { success: true, message: "Order logged successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }
}
