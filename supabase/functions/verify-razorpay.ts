// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac }   from "https://deno.land/std@0.224.0/crypto/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const razorSecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const supabase = createClient(supabaseUrl, serviceKey);

Deno.serve(async req => {
  try {
    const body = await req.json();   // { order_id, razorpay_payment_id, razorpay_signature }

    const { order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!order_id || !razorpay_payment_id || !razorpay_signature)
      return new Response("Bad payload", { status: 400 });

    // 1. Verify signature
    const hmac = createHmac("sha256", razorSecret);
    hmac.update(`${order_id}|${razorpay_payment_id}`);
    const expected = hmac.hex();

    if (expected !== razorpay_signature) {
      await supabase.from("donations")
        .update({ status: "failed" })
        .eq("order_id", order_id);
      return new Response("Invalid signature", { status: 400 });
    }

    // 2. Update row
    await supabase.from("donations")
      .update({ payment_id: razorpay_payment_id, status: "verified" })
      .eq("order_id", order_id);

    return new Response("OK");
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
});