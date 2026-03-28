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
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', 'admin123');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('entry_time', '08:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('exit_time', '17:00');
`);

async function startServer() {
  const app = express();
  
  // Aumentar el límite para recibir fotos en base64
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  const PORT = 3000;

  // Helper para normalizar fechas de DD-MM-YYYY a YYYY-MM-DD
  const normalizeDate = (timestamp: string) => {
    let [date, time] = timestamp.split(' ');
    if (date.includes('-') && date.split('-')[0].length === 2) {
      const [d, m, y] = date.split('-');
      date = `${y}-${m}-${d}`;
    }
    return { date, time };
  };

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

  // Obtener configuraciones
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(config);
  });

  // Actualizar configuraciones
  app.put("/api/settings", (req, res) => {
    const { entry_time, exit_time } = req.body;
    try {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'entry_time'").run(entry_time);
      db.prepare("UPDATE settings SET value = ? WHERE key = 'exit_time'").run(exit_time);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Error al actualizar configuración" });
    }
  });

  // Exportar para Power BI (CSV)
  app.get("/api/export", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC").all();
    const settings = db.prepare("SELECT * FROM settings").all();
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const csvRows = ["ID,Empleado,Cargo,Tipo,Fecha,Hora,Estado"];
    
    logs.forEach((log: any) => {
      const { date, time } = normalizeDate(log.timestamp);
      let status = "A tiempo";
      
      if (log.type === 'Entrada') {
        if (time > config.entry_time) status = "Tarde";
      } else {
        if (time < config.exit_time) status = "Salida Temprana";
      }

      csvRows.push(`${log.employee_id},"${log.employee_name}","${log.position}",${log.type},${date},${time},${status}`);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=asistencia_central.csv');
    res.send(csvRows.join('\n'));
  });

  // Estadísticas de los últimos 5 días
  app.get("/api/stats/summary", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC").all();
    const settings = db.prepare("SELECT * FROM settings").all();
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const now = new Date();
    const todayStr = req.query.date as string || now.toISOString().split('T')[0];
    
    const fiveDaysAgo = new Date(todayStr);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

    const lateEmployees = new Set();
    const onTimeToday = new Set();
    const earlyExitToday = new Set();

    logs.forEach((log: any) => {
      const { date, time } = normalizeDate(log.timestamp);

      if (date >= fiveDaysAgoStr && date <= todayStr) {
        if (log.type === 'Entrada' && time > config.entry_time) {
          lateEmployees.add(log.employee_id);
        }
      }

      if (date === todayStr) {
        if (log.type === 'Entrada') {
          if (time <= config.entry_time) onTimeToday.add(log.employee_id);
        } else {
          if (time < config.exit_time) earlyExitToday.add(log.employee_id);
        }
      }
    });

    res.json({
      late_last_5_days: lateEmployees.size,
      on_time_today: onTimeToday.size,
      early_exit_today: earlyExitToday.size,
      total_employees: db.prepare("SELECT COUNT(*) as count FROM employees").get().count
    });
  });

  // Obtener registros de asistencia con estado
  app.get("/api/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC").all();
    const settings = db.prepare("SELECT * FROM settings").all();
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const logsWithStatus = logs.map((log: any) => {
      const { time } = normalizeDate(log.timestamp);
      let status = "A tiempo";
      
      if (log.type === 'Entrada') {
        if (time > config.entry_time) status = "Tarde";
      } else {
        if (time < config.exit_time) status = "Salida Temprana";
      }
      
      return { ...log, status };
    });

    res.json(logsWithStatus);
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
    const { date } = normalizeDate(timestamp);
    
    const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(employee_id);
    if (!emp) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    // Verificar si ya existe un registro del mismo tipo para el mismo día
    const existing = db.prepare(`
      SELECT * FROM logs 
      WHERE employee_id = ? AND type = ? AND timestamp LIKE ?
    `).get(employee_id, type, `${date}%`);

    if (existing) {
      return res.status(400).json({ error: `Ya has registrado tu ${type} hoy.` });
    }

    try {
      db.prepare(`
        INSERT INTO logs (employee_id, employee_name, position, type, photo, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(employee_id, emp.full_name, emp.position, type, photo, timestamp);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Error al guardar el registro" });
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
