import type { Dict } from "./types";

/**
 * Login / signup and their messages (lane L2).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const auth: Dict = {
  "Enter a valid email": "Masukkan email yang betul",
  "Password must be at least 6 characters": "Password mesti 6 aksara atau lebih",
  "Check your email to confirm your account, then sign in.": "Check email untuk confirm akaun, lepas tu login.",
  "Name": "Nama",
  "Email": "Email",
  "Password": "Password",
  "Sign in": "Login",
  "Create account": "Daftar akaun",
  "No account?": "Belum ada akaun?",
  "Have an account?": "Dah ada akaun?",
  "Supabase isn't configured, so any submit opens the demo dashboard.": "Supabase belum setup, jadi submit apa-apa pun buka dashboard demo.",
  "Welcome back": "Selamat kembali",
  "Sign in to continue.": "Login untuk teruskan.",
  "Create your account": "Daftar akaun you",
  "It takes ten seconds.": "Sepuluh saat je.",
};
