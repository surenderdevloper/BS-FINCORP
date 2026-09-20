import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/money";

export default async function Home() {
  const store = await cookies();
  redirect(store.get(SESSION_COOKIE) ? "/dashboard" : "/login");
}