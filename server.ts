import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database("attendance.db");

// Inicialización de la base de datos
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
    timestamp TEXT
  );
  INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', 'admin123');
`);

async function startServer() {
  const app = express();
  
  // Aumentar el límite para recibir fotos en base64
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  const PORT = 3000;

  // --- API ROUTES ---

  // Login de Administrador
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare("SELECT * FROM admins WHERE username = ? AND password = ?").get(username, password);
    if (admin) {
      res.json({ success: true, admin: { id: admin.id, username: admin.username } });
    } else {
      res.status(401).json({ error: "Credenciales incorrectas" });
    }
  });

  // Obtener todos los empleados
  app.get("/api/employees", (req, res) => {
    res.json(db.prepare("SELECT * FROM employees ORDER BY full_name ASC").all());
  });
  
  // Agregar empleado
  app.post("/api/employees", (req, res) => {
    const { id, full_name, id_card, position } = req.body;
    try {
      db.prepare("INSERT INTO employees (id, full_name, id_card, position) VALUES (?, ?, ?, ?)").run(id, full_name, id_card, position);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "El ID ya existe o datos inválidos" });
    }
  });

  // Actualizar empleado
  app.put("/api/employees/:id", (req, res) => {
    const { full_name, id_card, position } = req.body;
    try {
      db.prepare("UPDATE employees SET full_name = ?, id_card = ?, position = ? WHERE id = ?").run(full_name, id_card, position, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Error al actualizar" });
    }
  });

  // Eliminar empleado
  app.delete("/api/employees/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Error al eliminar" });
    }
  });

  // Obtener registros de asistencia
  app.get("/api/logs", (req, res) => {
    res.json(db.prepare("SELECT * FROM logs ORDER BY timestamp DESC").all());
  });

  // Verificar si un empleado existe (para el check-in)
  app.get("/api/employees/check/:id", (req, res) => {
    const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
    if (emp) {
      res.json(emp);
    } else {
      res.status(404).json({ error: "Empleado no encontrado" });
    }
  });

  // Registrar asistencia (Entrada/Salida)
  app.post("/api/logs", (req, res) => {
    const { employee_id, type, photo, timestamp } = req.body;
    const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(employee_id);
    if (emp) {
      db.prepare(`
        INSERT INTO logs (employee_id, employee_name, position, type, photo, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(employee_id, emp.full_name, emp.position, type, photo, timestamp);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Empleado no encontrado" });
    }
  });

  // --- VITE INTEGRATION ---
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

  // --- SERVER START ---
  app.listen(PORT, "0.0.0.0", () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          if ((iface.family === 'IPv4' || (iface as any).family === 4) && !iface.internal) {
            localIp = iface.address;
            break;
          }
        }
      }
      if (localIp !== 'localhost') break;
    }

    console.log(`\n🚀 Tortillería La Central - Sistema de Asistencia`);
    console.log(`   - Acceso Local:    http://localhost:${PORT}`);
    console.log(`   - Acceso Red:     http://${localIp}:${PORT}`);
    console.log(`\nPara usar en otros dispositivos (celulares/tablets), asegúrate de estar en la misma red WiFi y usa la URL de 'Red'.\n`);
  });
}

startServer();
