// Loads .env.test so unit tests that touch the database use the test database.
import { config } from "dotenv";
config({ path: ".env.test" });
