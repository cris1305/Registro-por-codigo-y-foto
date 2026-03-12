import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    id_card TEXT,
    position TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT,
    employee_name TEXT,
    position TEXT,
    type TEXT,
    photo TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  );

  -- Insert default admin
  INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', 'admin123');
`);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const PORT = 3000;

  // API Routes
  
  // Admin Auth (Simple for demo, in production use bcrypt)
  app.post("/api/admin/register", (req, res) => {
    const { username, password } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)");
      stmt.run(username, password);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare("SELECT * FROM admins WHERE username = ? AND password = ?").get(username, password);
    if (admin) {
      res.json({ success: true, admin: { id: admin.id, username: admin.username } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Employee Management
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees").all();
    res.json(employees);
  });

  app.post("/api/employees", (req, res) => {
    const { id, full_name, id_card, position } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO employees (id, full_name, id_card, position) VALUES (?, ?, ?, ?)");
      stmt.run(id, full_name, id_card, position);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Employee ID already exists" });
    }
  });

  app.put("/api/employees/:id", (req, res) => {
    const { full_name, id_card, position } = req.body;
    const { id } = req.params;
    const stmt = db.prepare("UPDATE employees SET full_name = ?, id_card = ?, position = ? WHERE id = ?");
    stmt.run(full_name, id_card, position, id);
    res.json({ success: true });
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM employees WHERE id = ?");
    stmt.run(id);
    res.json({ success: true });
  });

  // Attendance Logs
  app.get("/api/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC").all();
    res.json(logs);
  });

  app.get("/api/employees/check/:id", (req, res) => {
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
    if (employee) {
      res.json(employee);
    } else {
      res.status(404).json({ error: "Persona no identificada" });
    }
  });

  app.post("/api/logs", (req, res) => {
    const { employee_id, type, photo } = req.body;
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employee_id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const stmt = db.prepare("INSERT INTO logs (employee_id, employee_name, position, type, photo) VALUES (?, ?, ?, ?, ?)");
    stmt.run(employee_id, employee.full_name, employee.position, type, photo);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          // Check for IPv4 and non-internal (not 127.0.0.1)
          if ((iface.family === 'IPv4' || (iface as any).family === 4) && !iface.internal) {
            localIp = iface.address;
            break;
          }
        }
      }
      if (localIp !== 'localhost') break;
    }

    console.log(`\n🚀 Servidor de Tortillería La Central corriendo:`);
    console.log(`   - Local:    http://localhost:${PORT}`);
    console.log(`   - Red:      http://${localIp}:${PORT}`);
    console.log(`\nUsa la URL de 'Red' para conectar otros dispositivos (celulares, tablets) en la misma red WiFi.\n`);
  });
}

startServer();
