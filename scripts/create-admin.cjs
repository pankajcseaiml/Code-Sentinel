const bcrypt = require("bcryptjs");
const { Client } = require("pg");

async function createAdminUser() {
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

    // Check if admin already exists
    const checkResult = await client.query(
      "SELECT * FROM users WHERE email = $1",
      ["admin@codesentinel.com"],
    );

    if (checkResult.rows.length > 0) {
      console.log("Admin user already exists");
      return;
    }

    // Create admin user with password 'admin123'
    const passwordHash = await bcrypt.hash("admin123", 10);

    await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_admin) 
       VALUES ($1, $2, $3, $4)`,
      ["admin@codesentinel.com", passwordHash, "Admin User", true],
    );

    console.log("Admin user created successfully!");
    console.log("Email: admin@codesentinel.com");
    console.log("Password: admin123");
  } catch (error) {
    console.error("Error creating admin user:", error);
    throw error;
  } finally {
    await client.end();
  }
}

createAdminUser().catch(console.error);
