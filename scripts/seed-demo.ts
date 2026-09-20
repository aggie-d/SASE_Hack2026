import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_USER_EMAIL;
const password = process.env.DEMO_USER_PASSWORD;

// 500,000 MWK represented in tambala: 500,000 × 100.
const OPENING_MWK_UNITS = 50_000_000n;

function requireEnvironmentValue(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`${name} is missing from .env.local`);
  }

  return value;
}

async function main(): Promise<void> {
  const supabaseUrl = requireEnvironmentValue(
    url,
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  const adminKey = requireEnvironmentValue(
    serviceRoleKey,
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  const demoEmail = requireEnvironmentValue(
    email,
    "DEMO_USER_EMAIL",
  );

  const demoPassword = requireEnvironmentValue(
    password,
    "DEMO_USER_PASSWORD",
  );

  const admin = createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  async function findUserIdByEmail(
    requestedEmail: string,
  ): Promise<string | null> {
    let page = 1;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 100,
      });

      if (error) {
        throw error;
      }

      const existingUser = data.users.find(
        (user) =>
          user.email?.toLowerCase() ===
          requestedEmail.toLowerCase(),
      );

      if (existingUser) {
        return existingUser.id;
      }

      if (data.users.length < 100) {
        return null;
      }

      page += 1;
    }
  }

  let userId = await findUserIdByEmail(demoEmail);

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        display_name: "Demo User",
      },
    });

    if (error) {
      throw error;
    }

    userId = data.user.id;
    console.log(`Created demo user: ${demoEmail}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(
      userId,
      {
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          display_name: "Demo User",
        },
      },
    );

    if (error) {
      throw error;
    }

    console.log(`Reusing demo user: ${demoEmail}`);
  }

  // The signup trigger creates the profile and wallet accounts.
  // The service role prepares this user for backend testing.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      display_name: "Demo User",
      verification_status: "verified",
      role: "operator",
    })
    .eq("user_id", userId);

  if (profileError) {
    throw profileError;
  }

  const { data: wallet, error: walletError } = await admin
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("purpose", "mwk_wallet")
    .eq("asset", "MWK")
    .single();

  if (walletError) {
    throw walletError;
  }

  const { data: clearing, error: clearingError } = await admin
    .from("accounts")
    .select("id")
    .is("owner_user_id", null)
    .eq("purpose", "collection_clearing")
    .eq("asset", "MWK")
    .single();

  if (clearingError) {
    throw clearingError;
  }

  const seedReference = `demo-opening-balance:${userId}`;

  const { data: existingDeposit, error: lookupError } = await admin
    .from("deposits")
    .select("id")
    .eq("user_id", userId)
    .eq("provider_reference", seedReference)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  let depositId = existingDeposit?.id;

  if (!depositId) {
    const { data: deposit, error: depositError } = await admin
      .from("deposits")
      .insert({
        user_id: userId,
        method: "bank_transfer",
        amount_units: OPENING_MWK_UNITS.toString(),
        asset: "MWK",
        provider: "demo_seed",
        provider_reference: seedReference,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (depositError) {
      throw depositError;
    }

    depositId = deposit.id;
  }

  const { error: journalError } = await admin.rpc(
    "ledger_post_journal",
    {
      p_operation_id: depositId,
      p_type: "deposit",
      p_entries: [
        {
          account_id: clearing.id,
          asset: "MWK",
          debit_units: OPENING_MWK_UNITS.toString(),
          credit_units: "0",
        },
        {
          account_id: wallet.id,
          asset: "MWK",
          debit_units: "0",
          credit_units: OPENING_MWK_UNITS.toString(),
        },
      ],
      p_consume_hold_ids: [],
      p_reversal_of: null,
    },
  );

  if (journalError) {
    throw journalError;
  }

  console.log("Demo seed completed.");
  console.log(`User: ${demoEmail}`);
  console.log("Verification: verified");
  console.log("Role: operator");
  console.log("Opening balance: 500,000 MWK");
}

main().catch((error: unknown) => {
  console.error("Demo seed failed:", error);
  process.exitCode = 1;
});