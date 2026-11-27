import { betterAuth } from "better-auth"
import { jwt } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import Database from "better-sqlite3"

export const auth = betterAuth({
  database: new Database("./auth.db"),          // dev; use a pg Pool in production
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  plugins: [jwt(), nextCookies()],              // nextCookies must be last
})