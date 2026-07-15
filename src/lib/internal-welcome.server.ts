/**
 * Server-only helper: send the welcome SMS to a newly created employee /
 * instructor. Internal accounts sign in with phone number, so we deliver
 * credentials via SMS instead of email.
 */
import { sendBulksmsbd, estimateSmsCount } from "@/lib/sms.server";
import { SITE_URL } from "@/lib/site-url";

type WelcomeInput = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: "employee" | "instructor";
};

export async function sendInternalWelcomeEmail(
  _admin: any,
  input: WelcomeInput,
): Promise<void> {
  try {
    if (!input.phone) return;
    const loginUrl = `${SITE_URL}/auth`;
    const roleLabel = input.role === "instructor" ? "Instructor" : "Employee";
    const message =
      `Polytechnic Tutorial — ${roleLabel} account created for ${input.fullName || "you"}.\n` +
      `Phone: ${input.phone}\n` +
      `Password: ${input.password}\n` +
      `Login: ${loginUrl}\n` +
      `Please change your password after first login.`;

    const res = await sendBulksmsbd({ to: input.phone, message });
    console.log(
      `[internal-welcome-sms] user=${input.userId} ok=${res.ok} status=${res.status} segments=${estimateSmsCount(message)}`,
    );
    if (!res.ok) {
      console.error(`[internal-welcome-sms] failed user=${input.userId} resp=${res.response}`);
    }
  } catch (err) {
    console.error("[internal-welcome-sms] error", input.userId, err);
  }
}
