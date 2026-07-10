import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PhoneSchema = z.object({
  phone: z.string().min(8).max(20),
});

export const checkPhoneAvailability = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PhoneSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = data.phone.replace(/^\+/, "");

    for (let page = 1; page <= 10; page += 1) {
      const { data: usersPage, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Error(error.message);

      const match = usersPage.users.find((user) => {
        const userPhone = user.phone ?? "";
        return userPhone === data.phone || userPhone.replace(/^\+/, "") === normalized;
      });

      if (match) return { registered: true as const };
      if (usersPage.users.length < 1000) break;
    }

    return { registered: false as const };
  });