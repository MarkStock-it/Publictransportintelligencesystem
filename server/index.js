import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const port = Number(process.env.PORT) || 5001;
const jwtSecret = process.env.JWT_SECRET || "dev-ptis-secret-change-me";

app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

const allowedRoles = ["commuter", "driver", "lgu"];

const seedUsers = [
  {
    id: "u-commuter-1",
    username: "commuter1",
    name: "Demo Commuter",
    role: "commuter",
    passwordHash: bcrypt.hashSync("commuter123", 10),
  },
  {
    id: "u-driver-1",
    username: "driver1",
    name: "Demo Driver",
    role: "driver",
    passwordHash: bcrypt.hashSync("driver123", 10),
  },
  {
    id: "u-lgu-1",
    username: "lgu1",
    name: "Demo LGU Officer",
    role: "lgu",
    passwordHash: bcrypt.hashSync("lgu123", 10),
  },
];

const users = [...seedUsers];

const safeUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
});

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
    },
    jwtSecret,
    { expiresIn: "8h" },
  );
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = users.find((u) => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid token user" });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Role '${role}' is required` });
    }
    return next();
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ptis-backend", now: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createToken(user);
  return res.json({ token, user: safeUser(user) });
});

app.post("/api/auth/register", async (req, res) => {
  const { username, password, name, role } = req.body ?? {};

  if (!username || !password || !name || !role) {
    return res.status(400).json({ message: "username, password, name, and role are required" });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  if (users.some((u) => u.username.toLowerCase() === String(username).toLowerCase())) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: `u-${role}-${users.length + 1}`,
    username: String(username),
    name: String(name),
    role,
    passwordHash,
  };

  users.push(newUser);
  const token = createToken(newUser);
  return res.status(201).json({ token, user: safeUser(newUser) });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.get("/api/commuter/overview", authRequired, requireRole("commuter"), (_req, res) => {
  res.json({
    routeTips: [
      "Best departure window today: 7:30-8:00 AM",
      "Route 2 currently has lighter passenger load",
    ],
    nearestStops: ["Colon Street", "Fuente Circle", "SM City"],
  });
});

app.get("/api/driver/overview", authRequired, requireRole("driver"), (_req, res) => {
  res.json({
    activeShift: true,
    todayTrips: 7,
    averageLoad: "74%",
  });
});

app.get("/api/lgu/overview", authRequired, requireRole("lgu"), (_req, res) => {
  res.json({
    activeVehicles: 10,
    averageWaitMinutes: 8,
    criticalCorridors: ["Route 2", "Route 4"],
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PTIS backend running on http://localhost:${port}`);
});
