import { closeDatabase, migrate } from "./db.mjs";
import { seedInitialAdmin, seedInitialDemoUser } from "./auth.mjs";

try {
  await migrate();
  await seedInitialAdmin();
  await seedInitialDemoUser();
  console.log("Database migration completed.");
} finally {
  await closeDatabase();
}
