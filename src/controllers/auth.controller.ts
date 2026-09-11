import type { Request, Response } from "express";
import { findUserByUsername } from "../services/auth/user.store.js";
import { verifyPassword, signToken } from "../services/auth/auth.service.js";

interface LoginRequestBody {
  username?: string;
  password?: string;
}

export async function handleLogin(
  req: Request<{}, {}, LoginRequestBody>,
  res: Response,
) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: 'Please send both "username" and "password".' });
  }

  const user = findUserByUsername(username);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = signToken({ sub: String(user.id), username: user.username });

  return res.json({ token });
}
