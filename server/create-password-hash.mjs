import bcrypt from "bcryptjs";

const password = process.env.PLAIN_PASSWORD;
if (!password || password.length < 12) {
  console.error("Set PLAIN_PASSWORD to a value with at least 12 characters before running this command.");
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
