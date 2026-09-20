import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { signSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    await dbConnect();
    
    const user = await User.findOne({ email });

const passwordMatch = user
  ? await bcrypt.compare(password, user.passwordHash)
  : false;

console.log("LOGIN DEBUG:", {
  email,
  userFound: !!user,
  passwordMatch,
});

if (!user) {
  return NextResponse.json(
    { error: "Invalid email or password." },
    { status: 401 }
  );
}

if (!passwordMatch) {
  return NextResponse.json(
    { error: "Invalid email or password." },
    { status: 401 }
  );
}

    const token = await signSessionToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    });

    const res = NextResponse.json({ name: user.name, email: user.email });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json(
      { error: "Server error. Check that MongoDB is reachable (MONGODB_URI)." },
      { status: 500 }
    );
  }
}