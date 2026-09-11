import { createUser, findUserByUsername } from "../src/services/auth/user.store.js";
import { hashPassword } from "../src/services/auth/auth.service.js";

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error("Usage: npm run create-user -- <username> <password>");
  process.exit(1);
}

if (findUserByUsername(username)) {
  console.error(`User "${username}" already exists.`);
  process.exit(1);
}

createUser(username, hashPassword(password));

console.log(`User "${username}" created.`);
