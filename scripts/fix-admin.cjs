const bcrypt = require("bcryptjs");
const { Client } = require("pg");

async function fixAdminUser() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "Error: DATABASE_URL environment variable is not defined. Please configure your .env file.",
    );
    process.exit(1);
  }
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("Connected to database");

    // Delete existing admin if exists
    await client.query("DELETE FROM users WHERE email = $1", [
      "admin@codesentinel.com",
    ]);
    console.log("Deleted old admin user if existed");

    // Create fresh admin user with password 'admin123'
    const passwordHash = await bcrypt.hash("admin123", 10);
    console.log("Generated password hash:", passwordHash);

    await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_admin) 
       VALUES ($1, $2, $3, $4)`,
      ["admin@codesentinel.com", passwordHash, "Admin User", true],
    );

    console.log("✅ Admin user created successfully!");
    console.log("Email: admin@codesentinel.com");
    console.log("Password: admin123");
    console.log("\nYou can now login with these credentials.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

fixAdminUser().catch(console.error);
