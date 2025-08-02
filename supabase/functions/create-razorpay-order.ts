// deno-lint-ignore-file no-explicit-any
import Razorpay from "https://esm.sh/razorpay@2.9.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const razorKeyId  = Deno.env.get("RAZORPAY_KEY_ID")!;
const razorSecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const supabase = createClient(supabaseUrl, serviceKey);
const razorpay = new Razorpay({ key_id: razorKeyId, key_secret: razorSecret });

Deno.serve(async req => {
  try {
    const { amount } = await req.json();       // amount in paise

    if (!amount || typeof amount !== "number")
      return new Response("Bad amount", { status: 400 });

    // 1. Create order on Razorpay
    const order: any = await razorpay.orders.create({
      amount,
      currency: "INR",
      payment_capture: 1
    });

    // 2. Insert row in donations table
    await supabase.from("donations").insert({
      amount,
      payment_id: null,
      order_id: order.id,        // add an order_id column or drop this if unused
      status: "created"
    });

    return Response.json({ orderId: order.id });
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
});