/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  User, 
  Users, 
  History, 
  LogOut, 
  LogIn, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight,
  ShieldCheck,
  Clock,
  Briefcase,
  IdCard,
  CheckCircle2,
  XCircle,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'user-check' | 'admin-login' | 'admin-dashboard' | 'admin-logs' | 'admin-users';

interface Employee {
  id: string;
  full_name: string;
  id_card: string;
  position: string;
}

interface Log {
  id: number;
  employee_id: string;
  employee_name: string;
  position: string;
  type: string;
  photo: string;
  timestamp: string;
}

export default function App() {
  const [view, setView] = useState<View>('user-check');
  const [admin, setAdmin] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (admin) {
      fetchEmployees();
      fetchLogs();
    }
  }, [admin]);

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees');
    const data = await res.json();
    setEmployees(data);
  };

  const fetchLogs = async () => {
    const res = await fetch('/api/logs');
    const data = await res.json();
    setLogs(data);
  };

  const handleUserCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/employees/check/${employeeId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentEmployee(data);
        setCameraActive(true);
        startCamera();
      } else {
        showStatus('Persona no identificada', 'error');
      }
    } catch (err) {
      showStatus('Error al conectar con el servidor', 'error');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      showStatus('No se pudo acceder a la cámara', 'error');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        return canvasRef.current.toDataURL('image/jpeg');
      }
    }
    return '';
  };

  const handleAttendance = async (type: 'Entrada' | 'Salida') => {
    const photo = capturePhoto();
    showStatus('Foto capturada con éxito', 'success');
    
    // Wait a bit so the user can see the "Photo captured" message
    setTimeout(async () => {
      try {
        const res = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: currentEmployee?.id,
            type,
            photo
          })
        });

        if (res.ok) {
          showStatus(type === 'Entrada' ? '¡Bienvenido!' : '¡Buen viaje!', 'success');
          setTimeout(() => {
            stopCamera();
            setCurrentEmployee(null);
            setEmployeeId('');
          }, 2000);
        }
      } catch (err) {
        showStatus('Error al guardar el registro', 'error');
      }
    }, 1500);
  };

  const showStatus = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const username = formData.get('username');
    const password = formData.get('password');

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const data = await res.json();
      setAdmin(data.admin);
      setView('admin-dashboard');
    } else {
      showStatus('Credenciales inválidas', 'error');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const employee = Object.fromEntries(formData);

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employee)
    });

    if (res.ok) {
      fetchEmployees();
      (e.target as HTMLFormElement).reset();
      showStatus('Empleado registrado', 'success');
    } else {
      showStatus('Error al registrar empleado', 'error');
    }
  };

  const deleteEmployee = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este usuario?')) {
      await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      fetchEmployees();
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('user-check')}>
          <div className="bg-orange-600 p-2 rounded-lg text-white">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Tortillería La Central</h1>
        </div>
        
        <div className="flex gap-4">
          {admin ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-stone-500">Admin: {admin.username}</span>
              <button 
                onClick={() => { setAdmin(null); setView('user-check'); }}
                className="flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-red-600 transition-colors"
              >
                <LogOut size={18} /> Salir
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView(view === 'admin-login' ? 'user-check' : 'admin-login')}
              className="flex items-center justify-center w-8 h-8 rounded-full text-stone-300 hover:text-orange-600 hover:bg-orange-50 transition-all"
              title="Admin"
            >
              <ShieldCheck size={16} />
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {/* User Check-in View */}
          {view === 'user-check' && (
            <motion.div 
              key="user-check"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto mt-12"
            >
              {!cameraActive ? (
                <div className="bg-white rounded-3xl shadow-2xl shadow-stone-200/60 border border-stone-100 p-10">
                  <div className="text-center mb-10">
                    <motion.div 
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <span className="text-[10px] uppercase tracking-[0.5em] text-orange-600 font-bold mb-3 block opacity-70">Bienvenido</span>
                      <h2 className="text-5xl font-extralight tracking-tight text-stone-900 mb-4">
                        Registro
                      </h2>
                      <div className="flex justify-center gap-1 mb-8">
                        <div className="h-1 w-8 bg-orange-600 rounded-full" />
                        <div className="h-1 w-2 bg-orange-200 rounded-full" />
                      </div>
                    </motion.div>
                    <p className="text-stone-400 text-sm font-medium max-w-[260px] mx-auto leading-relaxed">
                      Ingrese su identificador único para registrar su actividad de hoy.
                    </p>
                  </div>

                  <form onSubmit={handleUserCheck} className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[11px] uppercase tracking-widest text-stone-400 font-bold ml-1">ID de Empleado</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-300 group-focus-within:text-orange-500 transition-colors">
                          <IdCard size={20} />
                        </div>
                        <input 
                          type="text" 
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border border-stone-200 focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all text-lg font-medium placeholder:text-stone-300"
                          placeholder="ID de empleado..."
                          required
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 group"
                    >
                      Continuar <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold">{currentEmployee?.full_name}</h2>
                      <p className="text-sm text-stone-500">{currentEmployee?.position}</p>
                    </div>
                    <button onClick={stopCamera} className="text-stone-400 hover:text-stone-600">
                      <XCircle size={24} />
                    </button>
                  </div>

                  <div className="relative aspect-video bg-stone-900 rounded-xl overflow-hidden mb-6">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleAttendance('Entrada')}
                      className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 active:scale-95 text-white font-bold py-4 rounded-xl flex flex-col items-center gap-2 transition-all shadow-lg shadow-orange-600/20"
                    >
                      <LogIn size={24} />
                      Entrada
                    </button>
                    <button 
                      onClick={() => handleAttendance('Salida')}
                      className="bg-stone-800 hover:bg-stone-900 active:bg-black active:scale-95 text-white font-bold py-4 rounded-xl flex flex-col items-center gap-2 transition-all shadow-lg shadow-stone-800/20"
                    >
                      <LogOut size={24} />
                      Salida
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Admin Login View */}
          {view === 'admin-login' && (
            <motion.div 
              key="admin-login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto mt-12"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-8">
                <div className="text-center mb-8">
                  <div className="bg-stone-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="text-stone-800" size={32} />
                  </div>
                  <h2 className="text-2xl font-bold">Acceso Administrativo</h2>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">Usuario</label>
                    <input name="username" type="text" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-stone-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">Contraseña</label>
                    <input name="password" type="password" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-stone-500" required />
                  </div>
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl hover:bg-stone-800 transition-all">
                    Iniciar Sesión
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Admin Dashboard */}
          {admin && (
            <motion.div 
              key="admin-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex gap-4 overflow-x-auto pb-2">
                <button 
                  onClick={() => setView('admin-dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap active:scale-95 ${view === 'admin-dashboard' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
                >
                  <Users size={18} /> Gestión de Usuarios
                </button>
                <button 
                  onClick={() => setView('admin-logs')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap active:scale-95 ${view === 'admin-logs' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
                >
                  <History size={18} /> Historial de Registros
                </button>
              </div>

              {view === 'admin-dashboard' && (
                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Add Employee Form */}
                  <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 h-fit">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Plus size={20} className="text-orange-600" /> Nuevo Usuario
                    </h3>
                    <form onSubmit={handleAddEmployee} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase text-stone-400">ID Asignado</label>
                        <input name="id" type="text" className="w-full px-3 py-2 rounded-lg border border-stone-200 mt-1 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="EMP-001" required />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-stone-400">Nombre Completo</label>
                        <input name="full_name" type="text" className="w-full px-3 py-2 rounded-lg border border-stone-200 mt-1 focus:ring-2 focus:ring-orange-500 outline-none" required />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-stone-400">Cédula</label>
                        <input name="id_card" type="text" className="w-full px-3 py-2 rounded-lg border border-stone-200 mt-1 focus:ring-2 focus:ring-orange-500 outline-none" required />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-stone-400">Puesto</label>
                        <input name="position" type="text" className="w-full px-3 py-2 rounded-lg border border-stone-200 mt-1 focus:ring-2 focus:ring-orange-500 outline-none" required />
                      </div>
                      <button type="submit" className="w-full bg-orange-600 text-white font-bold py-2 rounded-lg mt-4 hover:bg-orange-700 active:bg-orange-800 active:scale-95 transition-all shadow-md shadow-orange-600/10">
                        Registrar Usuario
                      </button>
                    </form>
                  </div>

                  {/* Employee List */}
                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">Usuario</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">ID / Cédula</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {employees.map(emp => (
                          <tr key={emp.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold">{emp.full_name}</div>
                              <div className="text-xs text-stone-500">{emp.position}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-mono">{emp.id}</div>
                              <div className="text-xs text-stone-400">{emp.id_card}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button className="p-2 text-stone-400 hover:text-orange-600 transition-colors"><Edit2 size={16} /></button>
                                <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-stone-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {view === 'admin-logs' && (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-6 border-b border-stone-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Historial de Asistencia</h3>
                    <div className="text-sm text-stone-500">{logs.length} registros encontrados</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">Foto</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">Empleado</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">Tipo</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-stone-400">Fecha y Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {logs.map(log => (
                          <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                                <img src={log.photo} alt="Capture" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold">{log.employee_name}</div>
                              <div className="text-xs text-stone-500">{log.position} (ID: {log.employee_id})</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.type === 'Entrada' ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-700'}`}>
                                {log.type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-stone-600 flex items-center gap-2">
                                <Clock size={14} className="text-stone-400" />
                                {new Date(log.timestamp).toLocaleString()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Status Messages */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-orange-600 text-white' : 'bg-red-600 text-white'}`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              {message.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
