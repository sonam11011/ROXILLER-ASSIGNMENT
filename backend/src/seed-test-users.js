require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const users = [
  { email: "admin@test.roxiler.com", full_name: "System Administrator Test User", address: "Bhopal, Madhya Pradesh, India", role: "admin", passwordEnv: "TEST_ADMIN_PASSWORD" },
  { email: "owner@test.roxiler.com", full_name: "Store Owner Test User", address: "Bhopal, Madhya Pradesh, India", role: "owner", passwordEnv: "TEST_OWNER_PASSWORD" },
  { email: "user1@test.roxiler.com", full_name: "Normal User One Test Account", address: "Bhopal, Madhya Pradesh, India", role: "user", passwordEnv: "TEST_USER1_PASSWORD" },
  { email: "user2@test.roxiler.com", full_name: "Normal User Two Test Account", address: "Bhopal, Madhya Pradesh, India", role: "user", passwordEnv: "TEST_USER2_PASSWORD" },
  { email: "user3@test.roxiler.com", full_name: "Normal User Three Test Account", address: "Bhopal, Madhya Pradesh, India", role: "user", passwordEnv: "TEST_USER3_PASSWORD" }
];

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in backend/.env");
  }

  const { data: listed, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  for (const user of users) {
    const password = process.env[user.passwordEnv];
    if (!password) throw new Error(`Missing ${user.passwordEnv} in backend/.env`);

    let authUser = listed.users.find(
      (u) => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name, address: user.address }
      });
      if (error) throw error;
      authUser = data.user;
      console.log("Created " + user.email);
    } else {
      console.log("Already exists " + user.email);
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUser.id,
      full_name: user.full_name,
      address: user.address,
      role: user.role
    });
    if (profileError) throw profileError;
  }

  console.log("Test users are ready.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
