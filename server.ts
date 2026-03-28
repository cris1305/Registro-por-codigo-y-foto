import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(process.cwd(), "attendance_db.json");

// --- STORAGE SYSTEM (JSON BASED) ---
interface DBStructure {
  admins: any[];
  employees: any[];
  logs: any[];
  settings: { [key: string]: string };
}

const loadDB = (): DBStructure => {
  if (!fs.existsSync(DB_FILE)) {
    const initialDB: DBStructure = {
      admins: [{ id: 1, username: 'admin', password: 'admin123' }],
      employees: [],
      logs: [],
      settings: {
        entry_time: '08:00',
        exit_time: '17:00'
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

const saveDB = (data: DBStructure) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

async function startServer() {
  const app = express();
  let db = loadDB();
  
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
    const admin = db.admins.find(a => a.username === username && a.password === password);
    if (admin) {
      res.json({ success: true, admin: { id: admin.id, username: admin.username } });
    } else {
      res.status(401).json({ error: "Credenciales incorrectas" });
    }
  });

  // Obtener todos los empleados
  app.get("/api/employees", (req, res) => {
    res.json(db.employees.sort((a, b) => a.full_name.localeCompare(b.full_name)));
  });
  
  // Agregar empleado
  app.post("/api/employees", (req, res) => {
    const { id, full_name, id_card, position } = req.body;
    if (db.employees.find(e => e.id === id)) {
      return res.status(400).json({ error: "El ID ya existe" });
    }
    db.employees.push({ id, full_name, id_card, position });
    saveDB(db);
    res.json({ success: true });
  });

  // Actualizar empleado
  app.put("/api/employees/:id", (req, res) => {
    const { full_name, id_card, position } = req.body;
    const index = db.employees.findIndex(e => e.id === req.params.id);
    if (index !== -1) {
      db.employees[index] = { ...db.employees[index], full_name, id_card, position };
      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "No encontrado" });
    }
  });

  // Eliminar empleado
  app.delete("/api/employees/:id", (req, res) => {
    db.employees = db.employees.filter(e => e.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
  });

  // Obtener configuraciones
  app.get("/api/settings", (req, res) => {
    res.json(db.settings);
  });

  // Actualizar configuraciones
  app.put("/api/settings", (req, res) => {
    const { entry_time, exit_time } = req.body;
    db.settings.entry_time = entry_time;
    db.settings.exit_time = exit_time;
    saveDB(db);
    res.json({ success: true });
  });

  // Exportar para Power BI (CSV)
  app.get("/api/export", (req, res) => {
    const logs = [...db.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const config = db.settings;

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
    const logs = db.logs;
    const config = db.settings;

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
      total_employees: db.employees.length
    });
  });

  // Obtener registros de asistencia con estado
  app.get("/api/logs", (req, res) => {
    const logs = [...db.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const config = db.settings;

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
    const emp = db.employees.find(e => e.id === req.params.id);
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
    
    const emp = db.employees.find(e => e.id === employee_id);
    if (!emp) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    // Verificar si ya existe un registro del mismo tipo para el mismo día
    const existing = db.logs.find(l => 
      l.employee_id === employee_id && 
      l.type === type && 
      normalizeDate(l.timestamp).date === date
    );

    if (existing) {
      return res.status(400).json({ error: `Ya has registrado tu ${type} hoy.` });
    }

    try {
      db.logs.push({
        id: Date.now(),
        employee_id,
        employee_name: emp.full_name,
        position: emp.position,
        type,
        photo,
        timestamp
      });
      saveDB(db);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Error al guardar el registro" });
    }
  });

  // --- VITE INTEGRATION ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
