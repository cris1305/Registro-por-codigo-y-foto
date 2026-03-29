import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Users, History, LogOut, LogIn, Plus, Trash2, Edit2, ShieldCheck, 
  Clock, Contact, CheckCircle2, XCircle, ChevronRight, User, 
  LayoutDashboard, FileText, AlertTriangle, Settings, Menu, X, 
  Search, Download, RefreshCw, AlertCircle, Info, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type View = 'user-check' | 'admin-login' | 'admin-dashboard' | 'admin-logs' | 'admin-violations' | 'admin-settings' | 'admin-employees';

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
  const [admin, setAdmin] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('admin_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing admin_session:", e);
      return null;
    }
  });
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [employeeId, setEmployeeId] = useState('');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  
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
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (admin) {
      localStorage.setItem('admin_session', JSON.stringify(admin));
      fetchEmployees();
      fetchLogs();
      fetchSettings();
      fetchStats();
    } else {
      localStorage.removeItem('admin_session');
    }
  }, [admin]);

  useEffect(() => {
    if (admin && view === 'admin-login') {
      setView('admin-dashboard');
    } else if (!admin && view.startsWith('admin-')) {
      setView('admin-login');
    }
  }, [admin, view]);

  const requestCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setShowCameraHelp(true);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermissionStatus('granted');
      showStatus('Cámara habilitada correctamente', 'success');
    } catch (e) {
      setCameraPermissionStatus('denied');
      showStatus('Acceso a la cámara denegado o no disponible.', 'error');
    }
  };

  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermissionStatus(status.state as any);
          status.onchange = () => setCameraPermissionStatus(status.state as any);
          
          // Si el estado es prompt, intentar pedir permiso al cargar
          if (status.state === 'prompt' && view === 'user-check') {
            requestCameraPermission();
          }
        }
      } catch (e) {
        console.log("Error al consultar permisos:", e);
      }
    };
    checkPermission();
  }, [view]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) setEmployees(await res.json());
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
  };

  const fetchStats = async () => {
    try {
      const now = new Date();
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const res = await fetch(`/api/stats/summary?date=${today}`);
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
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
    (log.employee_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.employee_id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.status?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const showStatus = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
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

      // Check for HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isSecure) {
          setShowCameraHelp(true);
          showStatus('Conexión no segura detectada', 'error');
        } else {
          showStatus('Tu navegador no soporta acceso a la cámara o los permisos están bloqueados.', 'error');
        }
        return;
      }

      const constraints = { 
        video: { 
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(e => console.error("Error al reproducir video:", e));
      }
    } catch (err: any) {
      console.error("Error de cámara:", err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showStatus('Permiso de cámara denegado. Por favor, habilita el acceso en la configuración de tu navegador.', 'error');
      } else {
        // Reintento con configuración básica si falla la ideal
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        } catch (fallbackErr) {
          showStatus('No se pudo acceder a la cámara. Verifica los permisos y que no esté siendo usada por otra app.', 'error');
        }
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
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      });
      if (res.ok) {
        showStatus('Empleado agregado correctamente', 'success');
        setNewEmployee({ id: '', full_name: '', id_card: '', position: '' });
        setIsAddingEmployee(false);
        fetchEmployees();
        fetchStats();
      } else {
        const data = await res.json();
        showStatus(data.error || 'Error al agregar empleado', 'error');
      }
    } catch (e) {
      showStatus('Error de conexión al servidor', 'error');
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

  if (admin && view.startsWith('admin-')) {
    return (
      <div className="flex min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-orange-100 selection:text-orange-900 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-stone-900 text-white transition-all duration-500 flex flex-col z-50 shadow-2xl relative`}>
          <div className="p-8 flex items-center gap-4 border-b border-white/5">
            <div className="bg-orange-600 p-2.5 rounded-2xl shrink-0 shadow-lg shadow-orange-900/20">
              <ShieldCheck className="text-white" size={24} />
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-xl font-black tracking-tighter uppercase leading-none">La Central</h1>
                <p className="text-[9px] font-bold text-orange-500 uppercase tracking-[0.2em] mt-1">Admin Panel</p>
              </motion.div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2 mt-4">
            {[
              { id: 'admin-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'admin-employees', icon: Users, label: 'Personal' },
              { id: 'admin-logs', icon: History, label: 'Historial' },
              { id: 'admin-violations', icon: AlertTriangle, label: 'Incidencias' },
              { id: 'admin-settings', icon: Settings, label: 'Configuración' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id as View)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group relative ${
                  view === item.id 
                    ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/20' 
                    : 'text-stone-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={22} className={view === item.id ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
                {isSidebarOpen && <span className="font-bold text-sm">{item.label}</span>}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-stone-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-stone-500 hover:text-white hover:bg-white/5 transition-all"
            >
              {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
              {isSidebarOpen && <span className="font-bold text-sm">Contraer</span>}
            </button>
            <button 
              onClick={() => { setAdmin(null); setView('user-check'); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:text-white hover:bg-red-600/20 transition-all mt-2"
            >
              <LogOut size={22} />
              {isSidebarOpen && <span className="font-bold text-sm">Cerrar Sesión</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 p-6 flex justify-between items-center sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <div className="bg-stone-100 p-2 rounded-xl lg:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu size={20} />
              </div>
              <h2 className="text-xl font-black tracking-tight text-stone-900">
                {view === 'admin-dashboard' && 'Panel de Control'}
                {view === 'admin-employees' && 'Gestión de Personal'}
                {view === 'admin-logs' && 'Historial de Asistencia'}
                {view === 'admin-violations' && 'Control de Incidencias'}
                {view === 'admin-settings' && 'Configuración del Sistema'}
              </h2>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-stone-400 uppercase tracking-widest leading-none">Administrador</p>
                <p className="text-sm font-bold text-stone-900">{admin.username || 'Admin'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black border-2 border-white shadow-sm">
                {(admin.username || '?').charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                {view === 'admin-dashboard' && (
                  <motion.div key="admin-dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-4xl font-black tracking-tight">¡Hola de nuevo!</h2>
                        <p className="text-stone-500 font-medium">Aquí tienes el resumen de hoy en La Central.</p>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={handleExport}
                          className="bg-white border border-stone-200 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm"
                        >
                          <Download size={18} className="text-stone-400" />
                          Exportar Reporte
                        </button>
                      </div>
                    </div>

                    {/* Estadísticas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 group hover:border-orange-200 transition-all">
                        <div className="bg-stone-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-50 transition-colors">
                          <Users className="text-stone-400 group-hover:text-orange-600" size={24} />
                        </div>
                        <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">Total Empleados</p>
                        <p className="text-4xl font-black">{stats.total_employees}</p>
                      </div>
                      
                      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 group hover:border-green-200 transition-all">
                        <div className="bg-stone-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-50 transition-colors">
                          <CheckCircle2 className="text-stone-400 group-hover:text-green-600" size={24} />
                        </div>
                        <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">A tiempo hoy</p>
                        <p className="text-4xl font-black text-green-600">{stats.on_time_today}</p>
                      </div>

                      <div 
                        className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 group hover:border-red-200 transition-all cursor-pointer"
                        onClick={() => setView('admin-violations')}
                      >
                        <div className="bg-stone-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-50 transition-colors">
                          <AlertTriangle className="text-stone-400 group-hover:text-red-600" size={24} />
                        </div>
                        <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">Tarde (5 días)</p>
                        <div className="flex justify-between items-end">
                          <p className="text-4xl font-black text-red-600">{stats.late_last_5_days}</p>
                          <ChevronRight size={20} className="text-red-200 mb-1" />
                        </div>
                      </div>

                      <div 
                        className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 group hover:border-orange-200 transition-all cursor-pointer"
                        onClick={() => setView('admin-violations')}
                      >
                        <div className="bg-stone-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-50 transition-colors">
                          <Clock className="text-stone-400 group-hover:text-orange-600" size={24} />
                        </div>
                        <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">Salida Temprana</p>
                        <div className="flex justify-between items-end">
                          <p className="text-4xl font-black text-orange-600">{stats.early_exit_today}</p>
                          <ChevronRight size={20} className="text-orange-200 mb-1" />
                        </div>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-black flex items-center gap-2">
                            <History className="text-orange-600" size={24} />
                            Últimos Registros
                          </h3>
                          <button onClick={() => setView('admin-logs')} className="text-orange-600 font-bold text-sm hover:underline">Ver todos</button>
                        </div>
                        <div className="space-y-4">
                          {logs.slice(0, 5).map(log => (
                            <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 border border-stone-100">
                              <div className="flex items-center gap-3">
                                <img src={log.photo} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                <div>
                                  <p className="font-bold text-sm">{log.employee_name || 'Sin nombre'}</p>
                                  <p className="text-[10px] text-stone-400 font-bold uppercase">{log.type} • {(log.timestamp || '').split(' ')[1] || '--:--'}</p>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                log.status === 'A tiempo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {log.status}
                              </span>
                            </div>
                          ))}
                          {logs.length === 0 && <p className="text-center py-10 text-stone-400 font-bold">No hay registros hoy</p>}
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-black flex items-center gap-2">
                            <Users className="text-orange-600" size={24} />
                            Personal Reciente
                          </h3>
                          <button onClick={() => setView('admin-employees')} className="text-orange-600 font-bold text-sm hover:underline">Gestionar</button>
                        </div>
                        <div className="space-y-4">
                          {employees.slice(0, 5).map(emp => (
                            <div key={emp.id} className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 border border-stone-100">
                              <div className="flex items-center gap-3">
                                <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center text-stone-400 border border-stone-200">
                                  <User size={20} />
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{emp.full_name || 'Sin nombre'}</p>
                                  <p className="text-[10px] text-stone-400 font-bold uppercase">{emp.position || 'Sin cargo'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">ID: {emp.id}</p>
                              </div>
                            </div>
                          ))}
                          {employees.length === 0 && <p className="text-center py-10 text-stone-400 font-bold">No hay empleados registrados</p>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {view === 'admin-employees' && (
                  <motion.div key="admin-employees" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-3xl font-black tracking-tight">Gestión de Personal</h2>
                        <p className="text-stone-500 font-medium">Agrega, edita o elimina empleados del sistema</p>
                      </div>
                      <button 
                        onClick={() => setIsAddingEmployee(true)}
                        className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                      >
                        <Plus size={20} />
                        NUEVO EMPLEADO
                      </button>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden">
                      <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex flex-col md:flex-row gap-4 justify-between">
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                          <input 
                            type="text" 
                            placeholder="Buscar por nombre o ID..." 
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold text-stone-400">
                          <span>{employees.length} Empleados en total</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50/50 border-b border-stone-100">
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Empleado</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">ID / Cédula</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Cargo</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {employees.filter(e => 
                              (e.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                              (e.id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
                            ).map(emp => (
                              <tr key={emp.id} className="hover:bg-stone-50/50 transition-colors group">
                                <td className="p-6">
                                  <div className="flex items-center gap-4">
                                    <div className="bg-stone-100 w-12 h-12 rounded-2xl flex items-center justify-center text-stone-400 font-black text-xl group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                                      {emp.full_name.charAt(0)}
                                    </div>
                                    <div className="font-black text-stone-900">{emp.full_name}</div>
                                  </div>
                                </td>
                                <td className="p-6">
                                  <div className="font-bold text-stone-600">ID: {emp.id}</div>
                                  <div className="text-xs text-stone-400 font-bold uppercase tracking-tighter">Cédula: {emp.id_card}</div>
                                </td>
                                <td className="p-6">
                                  <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-600 text-[10px] font-black uppercase tracking-wider">
                                    {emp.position}
                                  </span>
                                </td>
                                <td className="p-6 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setEditingEmployee(emp)}
                                      className="p-3 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                                    >
                                      <Edit2 size={18} />
                                    </button>
                                    <button 
                                      onClick={() => setShowDeleteConfirm(emp.id)}
                                      className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                      <Trash2 size={18} />
                                    </button>
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

                {view === 'admin-logs' && (
                  <motion.div key="admin-logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                      <div>
                        <h2 className="text-3xl font-black tracking-tight">Historial de Asistencia</h2>
                        <p className="text-stone-500 font-medium">Registros detallados de entrada y salida</p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input 
                            type="text" 
                            placeholder="Buscar empleado o estado..." 
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={handleExport}
                          className="bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-stone-200"
                        >
                          <Download size={18} />
                          Exportar
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50/50 border-b border-stone-100">
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Empleado</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Tipo</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Estado</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Fecha y Hora</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-stone-400">Evidencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {filteredLogs.map(log => (
                              <tr key={log.id} className={`hover:bg-stone-50/30 transition-colors ${log.status !== 'A tiempo' ? 'bg-red-50/20' : ''}`}>
                                <td className="p-6">
                                  <div className="font-black text-stone-900">{log.employee_name || 'Sin nombre'}</div>
                                  <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter">ID: {log.employee_id || '---'} • {log.position || '---'}</div>
                                </td>
                                <td className="p-6">
                                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    log.type === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {log.type}
                                  </span>
                                </td>
                                <td className="p-6">
                                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    log.status === 'A tiempo' ? 'bg-green-50 text-green-600' : 'bg-red-600 text-white shadow-lg shadow-red-100'
                                  }`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="p-6 text-sm font-bold text-stone-500">
                                  {log.timestamp}
                                </td>
                                <td className="p-6">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm">
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

                {view === 'admin-violations' && (
                  <motion.div key="admin-violations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                      <div>
                        <h2 className="text-3xl font-black tracking-tight text-red-600">Incidencias</h2>
                        <p className="text-stone-500 font-medium">Personal que no ha cumplido con el horario establecido</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-red-100 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-red-50/50 border-b border-red-100">
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-red-400">Empleado</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-red-400">Tipo</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-red-400">Estado</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-red-400">Fecha y Hora</th>
                              <th className="p-6 text-xs font-black uppercase tracking-widest text-red-400">Evidencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {logs.filter(l => l.status !== 'A tiempo').map(log => (
                              <tr key={log.id} className="hover:bg-red-50/30 transition-colors bg-red-50/10">
                                <td className="p-6">
                                  <div className="font-black text-stone-900">{log.employee_name || 'Sin nombre'}</div>
                                  <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter">ID: {log.employee_id || '---'} • {log.position || '---'}</div>
                                </td>
                                <td className="p-6">
                                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    log.type === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {log.type}
                                  </span>
                                </td>
                                <td className="p-6">
                                  <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-lg shadow-red-100">
                                    {log.status}
                                  </span>
                                </td>
                                <td className="p-6 text-sm font-bold text-stone-500">
                                  {log.timestamp}
                                </td>
                                <td className="p-6">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm">
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

                {view === 'admin-settings' && (
                  <motion.div key="admin-settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto space-y-8">
                    <div>
                      <h2 className="text-3xl font-black tracking-tight">Configuración</h2>
                      <p className="text-stone-500 font-medium">Ajusta los parámetros de puntualidad y horarios</p>
                    </div>

                    <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-stone-100">
                      <form onSubmit={handleUpdateSettings} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={14} className="text-green-600" />
                              Hora de Entrada
                            </label>
                            <input 
                              type="time" 
                              value={settings.entry_time}
                              onChange={e => setSettings({...settings, entry_time: e.target.value})}
                              className="w-full p-5 rounded-2xl bg-stone-50 border-2 border-transparent focus:border-orange-500 outline-none font-black text-2xl transition-all"
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={14} className="text-orange-600" />
                              Hora de Salida
                            </label>
                            <input 
                              type="time" 
                              value={settings.exit_time}
                              onChange={e => setSettings({...settings, exit_time: e.target.value})}
                              className="w-full p-5 rounded-2xl bg-stone-50 border-2 border-transparent focus:border-orange-500 outline-none font-black text-2xl transition-all"
                            />
                          </div>
                        </div>

                        <div className="pt-6 border-t border-stone-100 flex flex-col gap-4">
                          <button 
                            type="submit" 
                            className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-orange-700 transition-all shadow-xl shadow-orange-200 flex justify-center items-center gap-3"
                          >
                            <RefreshCw size={20} />
                            ACTUALIZAR CONFIGURACIÓN
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* MODALES */}
        <AnimatePresence>
          {isAddingEmployee && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsAddingEmployee(false)}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black">Nuevo Empleado</h3>
                  <button onClick={() => setIsAddingEmployee(false)} className="text-stone-400 hover:text-stone-600">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">ID de Empleado</label>
                    <input 
                      type="text" placeholder="Ej: EMP001" required
                      className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                      value={newEmployee.id}
                      onChange={e => setNewEmployee({...newEmployee, id: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                    <input 
                      type="text" placeholder="Ej: Juan Pérez" required
                      className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                      value={newEmployee.full_name}
                      onChange={e => setNewEmployee({...newEmployee, full_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Cédula / ID Card</label>
                    <input 
                      type="text" placeholder="Ej: 12345678-9" required
                      className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                      value={newEmployee.id_card}
                      onChange={e => setNewEmployee({...newEmployee, id_card: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Cargo / Posición</label>
                    <input 
                      type="text" placeholder="Ej: Operador" required
                      className="w-full p-4 rounded-xl bg-stone-50 border outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                      value={newEmployee.position}
                      onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setIsAddingEmployee(false)} className="flex-1 p-4 rounded-xl font-bold text-stone-400 hover:bg-stone-50 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 bg-orange-600 text-white p-4 rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200">Guardar</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

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

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Navbar para Usuarios */}
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
          <button 
            onClick={() => setView(admin ? 'admin-dashboard' : 'admin-login')} 
            className="text-stone-300 hover:text-orange-600 transition-colors"
          >
            <ShieldCheck size={20} />
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-5xl mx-auto">
        {/* Ayuda de Cámara Segura */}
        <AnimatePresence>
          {showCameraHelp && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] flex gap-4">
                <div className="bg-red-100 w-12 h-12 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-black text-red-900 mb-1">Conexión No Segura Detectada</h3>
                  <p className="text-sm text-red-700 font-medium leading-relaxed mb-4">
                    Los navegadores modernos bloquean la cámara en sitios que no usan <strong>HTTPS</strong>. 
                    Si estás accediendo desde otro dispositivo en tu red local, esto es normal.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                      <Smartphone size={14} />
                      <span>Para solucionar esto:</span>
                    </div>
                    <ul className="text-xs text-red-700 space-y-1 list-disc ml-4 font-medium">
                      <li>Usa la URL que empieza con <strong>https://</strong> si está disponible.</li>
                      <li>Si usas la IP local (ej: 192.168...), el navegador la marcará como "No segura".</li>
                      <li>En Chrome (Android), puedes ir a <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> y añadir esta URL para permitir la cámara.</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => setShowCameraHelp(false)}
                    className="mt-4 text-xs font-black text-red-900 hover:underline"
                  >
                    ENTENDIDO, CERRAR
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    
                    {cameraPermissionStatus !== 'granted' && (
                      <button 
                        onClick={requestCameraPermission}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-600 rounded-full text-xs font-black hover:bg-orange-200 transition-colors"
                      >
                        <Camera size={14} />
                        HABILITAR CÁMARA
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleUserCheck} className="space-y-6">
                    <div className="relative">
                      <Contact className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
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

        </AnimatePresence>
      </main>

      {/* MODALES Y MENSAJES PARA VISTA DE USUARIO */}
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
