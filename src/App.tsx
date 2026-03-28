import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, History, LogOut, LogIn, Plus, Trash2, Edit2, ShieldCheck, Clock, IdCard, CheckCircle2, XCircle, ChevronRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'user-check' | 'admin-login' | 'admin-dashboard' | 'admin-logs' | 'admin-violations';

interface Employee {
  id: string;
  full_name: string;
  id_card: string;
  position: string;
}

interface AttendanceLog {
  id: number;
  employee_id: string;
  employee_name: string;
  position: string;
  type: 'Entrada' | 'Salida';
  photo: string;
  timestamp: string;
}

export default function App() {
  const [view, setView] = useState<View>('user-check');
  const [admin, setAdmin] = useState<any>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [employeeId, setEmployeeId] = useState('');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Admin States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<(AttendanceLog & { status: string })[]>([]);
  const [settings, setSettings] = useState({ entry_time: '08:00', exit_time: '17:00' });
  const [stats, setStats] = useState({ late_last_5_days: 0, on_time_today: 0, early_exit_today: 0, total_employees: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [newEmployee, setNewEmployee] = useState({ id: '', full_name: '', id_card: '', position: '' });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (admin) {
      fetchEmployees();
      fetchLogs();
      fetchSettings();
      fetchStats();
    }
  }, [admin]);

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees');
    setEmployees(await res.json());
  };

  const fetchLogs = async () => {
    const res = await fetch('/api/logs');
    setLogs(await res.json());
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    setSettings(await res.json());
  };

  const fetchStats = async () => {
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const res = await fetch(`/api/stats/summary?date=${today}`);
    setStats(await res.json());
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      showStatus('Configuración actualizada', 'success');
      setIsEditingSettings(false);
      fetchStats();
      fetchLogs();
    }
  };

  const handleExport = () => {
    window.open('/api/export', '_blank');
  };

  const filteredLogs = logs.filter(log => 
    log.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showStatus = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    if (res.ok) {
      const data = await res.json();
      setAdmin(data.admin);
      setView('admin-dashboard');
      showStatus('Sesión iniciada', 'success');
    } else {
      showStatus('Credenciales inválidas', 'error');
    }
  };

  // Iniciar cámara cuando se identifica al empleado
  useEffect(() => {
    if (currentEmployee && videoRef.current) {
      startCamera();
    }
  }, [currentEmployee]);

  const handleUserCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/employees/check/${employeeId}`);
    if (res.ok) {
      const data = await res.json();
      setCurrentEmployee(data);
      setCameraActive(true);
    } else {
      showStatus('Persona no identificada', 'error');
    }
  };

  const startCamera = async () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatus('Tu navegador no soporta acceso a la cámara o no estás en un sitio seguro.', 'error');
        return;
      }

      const constraints = { 
        video: { 
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(e => console.error("Error al reproducir video:", e));
      }
    } catch (err) {
      console.error("Error de cámara:", err);
      // Reintento con configuración básica si falla la ideal
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (fallbackErr) {
        showStatus('Error al acceder a la cámara. Verifica los permisos.', 'error');
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const handleAttendance = async (type: 'Entrada' | 'Salida') => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    
    const photo = canvasRef.current.toDataURL('image/jpeg', 0.6); // Reducir un poco la calidad para envíos más rápidos
    
    // Capturar fecha y hora local del dispositivo
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    showStatus('Procesando...', 'success');

    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: currentEmployee?.id,
        type,
        photo,
        timestamp
      })
    });

    if (res.ok) {
      showStatus(`¡${type} registrada con éxito!`, 'success');
      stopCamera();
      setCurrentEmployee(null);
      setEmployeeId('');
    } else {
      const errorData = await res.json();
      showStatus(errorData.error || 'Error al registrar asistencia', 'error');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEmployee)
    });
    if (res.ok) {
      showStatus('Empleado agregado', 'success');
      setNewEmployee({ id: '', full_name: '', id_card: '', position: '' });
      fetchEmployees();
    } else {
      showStatus('Error: El ID ya existe', 'error');
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const res = await fetch(`/api/employees/${editingEmployee.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingEmployee)
    });
    if (res.ok) {
      showStatus('Empleado actualizado', 'success');
      setEditingEmployee(null);
      fetchEmployees();
    }
  };

  const deleteEmployee = async (id: string) => {
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showStatus('Empleado eliminado', 'success');
      setShowDeleteConfirm(null);
      fetchEmployees();
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-stone-200 p-4 flex justify-between items-center sticky top-0 z-50">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => { stopCamera(); setView('user-check'); setCurrentEmployee(null); setEmployeeId(''); }}
        >
          <div className="bg-orange-600 p-2 rounded-xl group-hover:rotate-12 transition-transform">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase">La Central</h1>
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-[0.2em] -mt-1">Sistema de Asistencia</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {admin ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('admin-dashboard')}
                className={`p-2 rounded-lg transition-colors ${view === 'admin-dashboard' ? 'bg-orange-100 text-orange-600' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <Users size={20} />
              </button>
              <button 
                onClick={() => setView('admin-logs')}
                className={`p-2 rounded-lg transition-colors ${view === 'admin-logs' ? 'bg-orange-100 text-orange-600' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <History size={20} />
              </button>
              <button 
                onClick={() => setView('admin-violations')}
                className={`p-2 rounded-lg transition-colors ${view === 'admin-violations' ? 'bg-red-100 text-red-600' : 'text-stone-400 hover:text-red-600'}`}
              >
                <XCircle size={20} />
              </button>
              <button onClick={() => { setAdmin(null); setView('user-check'); }} className="text-stone-400 hover:text-red-600 p-2">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView('admin-login')} 
              className="text-stone-300 hover:text-orange-600 transition-colors"
            >
              <ShieldCheck size={20} />
            </button>
          )}
        </div>
      </nav>

      <main className="p-6 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'user-check' && (
            <motion.div 
              key="user-check"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              {!cameraActive ? (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-stone-200 border border-stone-100">
                  <div className="text-center mb-10">
                    <div className="bg-stone-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Clock className="text-orange-600" size={40} />
                    </div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">¡Hola!</h2>
                    <p className="text-stone-500 font-medium">Ingresa tu ID para registrar tu jornada</p>
                  </div>

                  <form onSubmit={handleUserCheck} className="space-y-6">
                    <div className="relative">
                      <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                      <input 
                        type="text" 
                        value={employeeId} 
                        onChange={e => setEmployeeId(e.target.value)}
                        className="w-full pl-12 pr-4 py-5 rounded-2xl bg-stone-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-xl font-bold"
                        placeholder="Tu número de ID"
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-black text-lg shadow-lg shadow-orange-200 transition-all flex justify-center items-center gap-2 group"
                    >
                      CONTINUAR
                      <ChevronRight className="group-hover:translate-x-1 transition-transform" size={24} />
                    </button>
                  </form>
                </div>
              ) : (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden"
                >
                  <div className="flex items-center gap-4 mb-6 bg-stone-50 p-4 rounded-2xl">
                    <div className="bg-orange-600 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                      {currentEmployee?.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-lg leading-tight">{currentEmployee?.full_name}</h3>
                      <p className="text-orange-600 font-bold text-xs uppercase tracking-widest">{currentEmployee?.position}</p>
                    </div>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] mb-6 shadow-inner">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-[12px] border-white/10 pointer-events-none"></div>
                    <div className="absolute top-4 right-4 bg-red-500 w-3 h-3 rounded-full animate-pulse"></div>
                  </div>
                  
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleAttendance('Entrada')}
                      className="bg-orange-600 hover:bg-orange-700 text-white p-6 rounded-2xl font-black flex flex-col items-center gap-2 transition-all active:scale-95"
                    >
                      <LogIn size={28} />
                      ENTRADA
                    </button>
                    <button 
                      onClick={() => handleAttendance('Salida')}
                      className="bg-stone-900 hover:bg-black text-white p-6 rounded-2xl font-black flex flex-col items-center gap-2 transition-all active:scale-95"
                    >
                      <LogOut size={28} />
                      SALIDA
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => { stopCamera(); setCurrentEmployee(null); setEmployeeId(''); }}
                    className="w-full mt-6 text-stone-400 font-bold text-sm hover:text-stone-600"
                  >
                    CANCELAR
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'admin-login' && (
            <motion.div 
              key="admin-login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm mx-auto"
            >
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-stone-100">
                <h2 className="text-2xl font-black mb-6 text-center">Acceso Admin</h2>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Usuario"
                    className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500"
                    value={loginData.username}
                    onChange={e => setLoginData({...loginData, username: e.target.value})}
                    required
                  />
                  <input 
                    type="password" 
                    placeholder="Contraseña"
                    className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500"
                    value={loginData.password}
                    onChange={e => setLoginData({...loginData, password: e.target.value})}
                    required
                  />
                  <button type="submit" className="w-full bg-stone-900 text-white p-4 rounded-xl font-bold hover:bg-black transition-colors">
                    Entrar
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('user-check')}
                    className="w-full text-stone-400 font-bold text-sm"
                  >
                    Volver
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'admin-dashboard' && (
            <motion.div key="admin-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Panel de Control</h2>
                  <p className="text-stone-500 font-medium">Gestiona el personal y configura horarios</p>
                </div>
                <button 
                  onClick={() => setIsEditingSettings(true)}
                  className="bg-white border border-stone-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-stone-50 transition-colors"
                >
                  <Clock size={18} className="text-orange-600" />
                  Configurar Horarios
                </button>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
                  <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">Total Empleados</p>
                  <p className="text-3xl font-black">{stats.total_employees}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
                  <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">A tiempo hoy</p>
                  <p className="text-3xl font-black text-green-600">{stats.on_time_today}</p>
                </div>
                <div 
                  className="bg-white p-6 rounded-3xl shadow-sm border border-red-100 cursor-pointer hover:bg-red-50 transition-colors"
                  onClick={() => setView('admin-violations')}
                >
                  <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">Tarde (5 días)</p>
                  <div className="flex justify-between items-end">
                    <p className="text-3xl font-black text-red-600">{stats.late_last_5_days}</p>
                    <ChevronRight size={20} className="text-red-300 mb-1" />
                  </div>
                </div>
                <div 
                  className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100 cursor-pointer hover:bg-orange-50 transition-colors"
                  onClick={() => setView('admin-violations')}
                >
                  <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">Salida Temprana hoy</p>
                  <div className="flex justify-between items-end">
                    <p className="text-3xl font-black text-orange-600">{stats.early_exit_today}</p>
                    <ChevronRight size={20} className="text-orange-300 mb-1" />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-stone-100 h-fit sticky top-24">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Plus className="text-orange-600" size={20} />
                    Nuevo Empleado
                  </h3>
                  <form onSubmit={handleAddEmployee} className="space-y-3">
                    <input 
                      type="text" placeholder="ID Empleado" required
                      className="w-full p-3 rounded-xl bg-stone-50 border text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      value={newEmployee.id}
                      onChange={e => setNewEmployee({...newEmployee, id: e.target.value})}
                    />
                    <input 
                      type="text" placeholder="Nombre Completo" required
                      className="w-full p-3 rounded-xl bg-stone-50 border text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      value={newEmployee.full_name}
                      onChange={e => setNewEmployee({...newEmployee, full_name: e.target.value})}
                    />
                    <input 
                      type="text" placeholder="Cédula / ID Card" required
                      className="w-full p-3 rounded-xl bg-stone-50 border text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      value={newEmployee.id_card}
                      onChange={e => setNewEmployee({...newEmployee, id_card: e.target.value})}
                    />
                    <input 
                      type="text" placeholder="Cargo / Posición" required
                      className="w-full p-3 rounded-xl bg-stone-50 border text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      value={newEmployee.position}
                      onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
                    />
                    <button type="submit" className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold text-sm hover:bg-orange-700 transition-colors">
                      Guardar Empleado
                    </button>
                  </form>
                </div>

                <div className="md:col-span-2 space-y-4">
                  {employees.map(emp => (
                    <div key={emp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex justify-between items-center group hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="bg-stone-100 w-12 h-12 rounded-xl flex items-center justify-center text-stone-400">
                          <User size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900">{emp.full_name}</h4>
                          <div className="flex gap-3 text-xs font-bold text-stone-400 uppercase tracking-wider">
                            <span>ID: {emp.id}</span>
                            <span className="text-orange-600/50">•</span>
                            <span>{emp.position}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingEmployee(emp)}
                          className="p-2 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(emp.id)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'admin-violations' && (
            <motion.div key="admin-violations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-red-600">Incidencias</h2>
                  <p className="text-stone-500 font-medium">Personal que no ha cumplido con el horario establecido</p>
                </div>
                <button 
                  onClick={() => setView('admin-logs')}
                  className="bg-stone-100 text-stone-600 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-stone-200 transition-colors"
                >
                  Ver Todo el Historial
                </button>
              </div>

              <div className="bg-white rounded-[2rem] shadow-xl border border-red-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-red-50/50 border-b border-red-100">
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-red-400">Empleado</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-red-400">Tipo</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-red-400">Estado</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-red-400">Fecha y Hora</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-red-400">Evidencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {logs.filter(l => l.status !== 'A tiempo').map(log => (
                        <tr key={log.id} className="hover:bg-red-50/30 transition-colors bg-red-50/10">
                          <td className="p-5">
                            <div className="font-bold text-stone-900">{log.employee_name}</div>
                            <div className="text-xs text-stone-400 font-medium uppercase tracking-tighter">ID: {log.employee_id} • {log.position}</div>
                          </td>
                          <td className="p-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              log.type === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-lg shadow-red-100">
                              {log.status}
                            </span>
                          </td>
                          <td className="p-5 text-sm font-medium text-stone-500">
                            {log.timestamp}
                          </td>
                          <td className="p-5">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                              <img 
                                src={log.photo} 
                                alt="Captura" 
                                className="w-full h-full object-cover cursor-zoom-in hover:scale-110 transition-transform"
                                onClick={() => window.open(log.photo)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {logs.filter(l => l.status !== 'A tiempo').length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-20 text-center">
                            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                              <CheckCircle2 size={32} />
                            </div>
                            <p className="font-bold text-stone-400">No hay incidencias registradas</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
          {view === 'admin-logs' && (
            <motion.div key="admin-logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Historial</h2>
                  <p className="text-stone-500 font-medium">Registros de entrada y salida con detección de puntualidad</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <input 
                      type="text" 
                      placeholder="Buscar empleado o estado..." 
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  </div>
                  <button 
                    onClick={handleExport}
                    className="bg-stone-900 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-colors"
                  >
                    <History size={18} />
                    Exportar Power BI
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-xl border border-stone-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100">
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Empleado</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Tipo</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Estado</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Fecha y Hora</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Evidencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredLogs.map(log => (
                        <tr key={log.id} className={`hover:bg-stone-50/50 transition-colors ${log.status !== 'A tiempo' ? 'bg-red-50/30' : ''}`}>
                          <td className="p-5">
                            <div className="font-bold text-stone-900">{log.employee_name}</div>
                            <div className="text-xs text-stone-400 font-medium uppercase tracking-tighter">ID: {log.employee_id} • {log.position}</div>
                          </td>
                          <td className="p-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              log.type === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              log.status === 'A tiempo' ? 'bg-green-50 text-green-600' : 'bg-red-600 text-white shadow-lg shadow-red-100'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="p-5 text-sm font-medium text-stone-500">
                            {log.timestamp}
                          </td>
                          <td className="p-5">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                              <img 
                                src={log.photo} 
                                alt="Captura" 
                                className="w-full h-full object-cover cursor-zoom-in hover:scale-110 transition-transform"
                                onClick={() => window.open(log.photo)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODALES */}
      <AnimatePresence>
        {editingEmployee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingEmployee(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl"
            >
              <h3 className="text-2xl font-black mb-6">Editar Empleado</h3>
              <form onSubmit={handleUpdateEmployee} className="space-y-4">
                <input 
                  type="text" value={editingEmployee.full_name} 
                  onChange={e => setEditingEmployee({...editingEmployee, full_name: e.target.value})}
                  className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  placeholder="Nombre Completo"
                />
                <input 
                  type="text" value={editingEmployee.id_card} 
                  onChange={e => setEditingEmployee({...editingEmployee, id_card: e.target.value})}
                  className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  placeholder="Cédula"
                />
                <input 
                  type="text" value={editingEmployee.position} 
                  onChange={e => setEditingEmployee({...editingEmployee, position: e.target.value})}
                  className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  placeholder="Cargo"
                />
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingEmployee(null)} className="flex-1 p-4 rounded-xl font-bold text-stone-400 hover:bg-stone-50 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 bg-orange-600 text-white p-4 rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200">Guardar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl text-center"
            >
              <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-600">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2">¿Estás seguro?</h3>
              <p className="text-stone-500 font-medium mb-8">Esta acción eliminará permanentemente al empleado.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 p-4 rounded-xl font-bold text-stone-400 hover:bg-stone-50 transition-colors">Cancelar</button>
                <button onClick={() => deleteEmployee(showDeleteConfirm)} className="flex-1 bg-red-600 text-white p-4 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {isEditingSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsEditingSettings(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl"
            >
              <h3 className="text-2xl font-black mb-6">Configurar Horarios</h3>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Hora de Entrada (HH:MM)</label>
                  <input 
                    type="time" 
                    value={settings.entry_time} 
                    onChange={e => setSettings({...settings, entry_time: e.target.value})}
                    className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold text-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Hora de Salida (HH:MM)</label>
                  <input 
                    type="time" 
                    value={settings.exit_time} 
                    onChange={e => setSettings({...settings, exit_time: e.target.value})}
                    className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold text-xl"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditingSettings(false)} className="flex-1 p-4 rounded-xl font-bold text-stone-400 hover:bg-stone-50 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 bg-orange-600 text-white p-4 rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200">Guardar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mensajes Flotantes */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={`px-6 py-3 rounded-full shadow-2xl text-white font-bold flex items-center gap-3 ${
              message.type === 'success' ? 'bg-orange-600' : 'bg-red-600'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              {message.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
