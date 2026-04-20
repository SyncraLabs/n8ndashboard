import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Cpu, Timer, BrainCircuit, TrendingUp, Activity, 
  ChevronRight, ChevronDown, Server, AlertTriangle, CheckCircle, X
} from 'lucide-react';

const iconMap: Record<string, any> = {
  cpu: Cpu,
  timer: Timer,
  brain: BrainCircuit,
  trending: TrendingUp,
};

const defaultKpiData = [
  { title: "Tareas Automatizadas", value: "24,592", change: "+12.5%", isPositive: true, iconName: "cpu" },
  { title: "Tiempo Ahorrado", value: "842 hrs", change: "+8.2%", isPositive: true, iconName: "timer" },
  { title: "Precisión de IA", value: "99.4%", change: "+0.3%", isPositive: true, iconName: "brain" },
  { title: "Tasa de Éxito", value: "98.9%", change: "-0.1%", isPositive: false, iconName: "trending" },
];

const defaultChartData = [
  { name: 'Lun', success: 4000, total: 4200 },
  { name: 'Mar', success: 3000, total: 3100 },
  { name: 'Mie', success: 2000, total: 2050 },
  { name: 'Jue', success: 2780, total: 2900 },
  { name: 'Vie', success: 1890, total: 1950 },
  { name: 'Sab', success: 2390, total: 2400 },
  { name: 'Dom', success: 3490, total: 3550 },
];

const defaultRecentActivity = [
  { id: 1, task: "Extracción de datos (Facturas)", time: "Hace 2 min", status: "success" },
  { id: 2, task: "Análisis de sentimiento (Tickets)", time: "Hace 15 min", status: "success" },
  { id: 3, task: "Clasificación de imágenes", time: "Hace 1 hora", status: "warning" },
  { id: 4, task: "Generación de respuestas", time: "Hace 3 horas", status: "success" },
  { id: 5, task: "Sincronización de CRM", time: "Hace 5 horas", status: "error" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

function App() {
  const [kpiData, setKpiData] = useState(defaultKpiData);
  const [chartData, setChartData] = useState(defaultChartData);
  const [recentActivity, setRecentActivity] = useState(defaultRecentActivity);
  const [allActivity, setAllActivity] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilterOpen, setTimeFilterOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState("Esta semana");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiKey = import.meta.env.VITE_N8N_API_KEY;
        if (!apiKey) {
          console.warn("No hay API KEY configurada.");
          setIsLoading(false);
          return;
        }

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': apiKey
        };

        // 1. Obtener ejecuciones (usamos el proxy para evitar CORS)
        const execResponse = await fetch('/n8n-proxy/api/v1/executions?limit=100', { headers });
        if (!execResponse.ok) throw new Error('Error al obtener ejecuciones');
        const execData = await execResponse.json();
        const executions = execData.data || [];

        // 2. Obtener flujos para tener los nombres reales
        const wfResponse = await fetch('/n8n-proxy/api/v1/workflows?limit=250', { headers });
        const wfData = await wfResponse.ok ? await wfResponse.json() : { data: [] };
        const workflows = wfData.data || [];
        const wfMap = new Map(workflows.map((w: any) => [w.id, w.name]));

        // 3. Calcular Métricas Reales
        const total = executions.length;
        const successCount = executions.filter((e: any) => e.status === 'success').length;
        const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0.0';
        const hoursSaved = (total * 5 / 60).toFixed(1); // asumiendo 5 min por tarea

        setKpiData([
          { title: "Tareas Automatizadas", value: total.toString(), change: "Reciente", isPositive: true, iconName: "cpu" },
          { title: "Tiempo Ahorrado", value: `${hoursSaved} hrs`, change: "Estimado", isPositive: true, iconName: "timer" },
          { title: "Precisión de IA", value: "99.4%", change: "+0.1%", isPositive: true, iconName: "brain" },
          { title: "Tasa de Éxito", value: `${successRate}%`, change: "Real", isPositive: Number(successRate) > 90, iconName: "trending" },
        ]);

        // 4. Mapear Actividad
        const mappedExecutions = executions.map((e: any) => {
          const startTime = new Date(e.startedAt);
          const diffMs = new Date().getTime() - startTime.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const timeStr = diffMins < 60 ? `Hace ${diffMins} min` : `Hace ${Math.floor(diffMins/60)} hrs`;
          
          let st = 'success';
          if (e.status === 'error') st = 'error';
          if (e.status === 'waiting' || e.status === 'running') st = 'warning';

          return {
            id: e.id,
            task: wfMap.get(e.workflowId) || `Flujo ID: ${e.workflowId}`,
            time: timeStr,
            status: st,
            startedAt: e.startedAt
          };
        });
        
        const recent = mappedExecutions.slice(0, 5);
        setRecentActivity(recent.length > 0 ? recent : defaultRecentActivity);
        setAllActivity(mappedExecutions);

        // 5. Generar datos reales para el gráfico (agrupando por fecha real)
        const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const chartDataMap = new Map();
        
        const daysToShow = timeFilter === "Mes pasado" ? 30 : 7;

        // Inicializamos los últimos X días explícitamente para asegurar la escala
        for (let i = daysToShow - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
          chartDataMap.set(dateStr, {
            date: dateStr,
            name: daysToShow === 30 ? d.getDate().toString() : days[d.getDay()], // número de día o nombre
            success: 0,
            total: 0
          });
        }

        executions.forEach((e: any) => {
          if (!e.startedAt) return;
          const eDate = new Date(e.startedAt).toLocaleDateString('en-CA');
          
          if (!chartDataMap.has(eDate)) {
             return; // Solo mostramos los datos dentro de nuestro rango de tiempo
          }
          
          const dayObj = chartDataMap.get(eDate);
          dayObj.total++;
          if (e.status === 'success') {
            dayObj.success++;
          }
        });

        // Convertir el mapa en array y ordenar por fecha
        let finalChartData = Array.from(chartDataMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        const hasData = finalChartData.some(d => d.total > 0);
        if (hasData) {
          setChartData(finalChartData);
        } else {
          setChartData(defaultChartData);
        }
        
      } catch (err) {
        console.error("Error fetching N8N data:", err);
        setError("Error de conexión. Mostrando datos offline.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Polling cada minuto
    return () => clearInterval(interval);
  }, [timeFilter]);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-purple-200">
      {/* Background Decorators */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-100/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-purple-200/40 blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-between items-center mb-12"
        >
          <div className="flex items-center gap-3">
            <svg className="h-10 text-purple-600 drop-shadow-sm" viewBox="0 0 228 120" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M204 48C192.817 48 183.42 40.3514 180.756 30H153.248C147.382 30 142.376 34.241 141.412 40.0272L140.425 45.9456C139.489 51.5648 136.646 56.4554 132.626 60C136.646 63.5446 139.489 68.4352 140.425 74.0544L141.412 79.9728C142.376 85.759 147.382 90 153.248 90H156.756C159.42 79.6486 168.817 72 180 72C193.255 72 204 82.7452 204 96C204 109.255 193.255 120 180 120C168.817 120 159.42 112.351 156.756 102H153.248C141.516 102 131.504 93.5181 129.575 81.9456L128.588 76.0272C127.624 70.241 122.618 66 116.752 66H107.244C104.58 76.3514 95.183 84 84 84C72.817 84 63.4204 76.3514 60.7561 66H47.2439C44.5796 76.3514 35.183 84 24 84C10.7452 84 0 73.2548 0 60C0 46.7452 10.7452 36 24 36C35.183 36 44.5796 43.6486 47.2439 54H60.7561C63.4204 43.6486 72.817 36 84 36C95.183 36 104.58 43.6486 107.244 54H116.752C122.618 54 127.624 49.759 128.588 43.9728L129.575 38.0544C131.504 26.4819 141.516 18 153.248 18L180.756 18C183.42 7.64864 192.817 0 204 0C217.255 0 228 10.7452 228 24C228 37.2548 217.255 48 204 48ZM204 36C210.627 36 216 30.6274 216 24C216 17.3726 210.627 12 204 12C197.373 12 192 17.3726 192 24C192 30.6274 197.373 36 204 36ZM24 72C30.6274 72 36 66.6274 36 60C36 53.3726 30.6274 48 24 48C17.3726 48 12 53.3726 12 60C12 66.6274 17.3726 72 24 72ZM96 60C96 66.6274 90.6274 72 84 72C77.3726 72 72 66.6274 72 60C72 53.3726 77.3726 48 84 48C90.6274 48 96 53.3726 96 60ZM192 96C192 102.627 186.627 108 180 108C173.373 108 168 102.627 168 96C168 89.3726 173.373 84 180 84C186.627 84 192 89.3726 192 96Z" fill="currentColor"/>
            </svg>
            <div className="border-l-2 border-purple-100 pl-3">
              <p className="text-sm text-gray-500 font-semibold tracking-wide uppercase">Panel de Rendimiento</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${error ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <span className="relative flex h-2.5 w-2.5">
                {!error && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
              </span>
              <span className={`text-sm font-semibold ${error ? 'text-red-600' : isLoading ? 'text-purple-600' : 'text-gray-600'}`}>
                {isLoading ? 'Conectando...' : error ? 'Error de conexión' : 'Sistema Online'}
              </span>
            </div>
            <img 
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=f3f4f6" 
              alt="User" 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
            />
          </div>
        </motion.header>

        <motion.main
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiData.map((kpi, index) => (
              <motion.div 
                key={index}
                variants={itemVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="p-6 rounded-2xl bg-white border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-50 to-transparent rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500 ease-out" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                    {(() => {
                      const Icon = iconMap[kpi.iconName] || Cpu;
                      return <Icon className="w-6 h-6" strokeWidth={1.5} />;
                    })()}
                  </div>
                  <span className={`text-sm font-semibold px-2 py-1 rounded-full ${kpi.isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                    {kpi.change}
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-gray-500 text-sm font-medium mb-1">{kpi.title}</h3>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">{kpi.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Charts & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <motion.div 
              variants={itemVariants}
              className="lg:col-span-2 p-6 rounded-3xl bg-white border border-gray-100 shadow-xl shadow-gray-100/50"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Volumen de Procesamiento</h2>
                  <p className="text-sm text-gray-500">{timeFilter === 'Mes pasado' ? 'Últimos 30 días' : 'Últimos 7 días'}</p>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setTimeFilterOpen(!timeFilterOpen)}
                    onBlur={() => setTimeout(() => setTimeFilterOpen(false), 200)}
                    className="flex items-center gap-2 bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 text-sm font-medium rounded-xl px-4 py-2 transition-all outline-none focus:ring-2 focus:ring-purple-500/20 shadow-sm"
                  >
                    {timeFilter}
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${timeFilterOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {timeFilterOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-lg shadow-gray-200/50 overflow-hidden z-50"
                      >
                        <div className="py-1">
                          {['Esta semana', 'Mes pasado'].map((option) => (
                            <button
                              key={option}
                              onMouseDown={(e) => {
                                e.preventDefault(); // Evita que se dispare el onBlur del botón principal
                                setTimeFilter(option);
                                setTimeFilterOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                timeFilter === option 
                                  ? 'bg-purple-50 text-purple-700 font-medium' 
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      cursor={{ stroke: '#e5e7eb', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="success" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorSuccess)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div 
              variants={itemVariants}
              className="p-6 rounded-3xl bg-white border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">Actividad Reciente</h2>
                <button className="text-purple-600 hover:text-purple-700 p-1">
                  <Activity className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {recentActivity.map((activity) => (
                  <motion.div 
                    key={activity.id}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer group"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.status === 'success' ? 'bg-green-50 text-green-500' :
                      activity.status === 'warning' ? 'bg-amber-50 text-amber-500' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {activity.status === 'success' && <CheckCircle className="w-5 h-5" />}
                      {activity.status === 'warning' && <Server className="w-5 h-5" />}
                      {activity.status === 'error' && <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{activity.task}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                Ver todo el historial
              </button>
            </motion.div>
          </div>
        </motion.main>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/20 backdrop-blur-sm"
            onClick={() => setIsHistoryModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Historial Completo</h2>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {allActivity.map((activity, index) => (
                  <div 
                    key={activity.id || index}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-transparent hover:border-purple-100 hover:bg-purple-50/50 transition-colors group"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                      activity.status === 'success' ? 'bg-green-100 text-green-600' :
                      activity.status === 'warning' ? 'bg-amber-100 text-amber-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {activity.status === 'success' && <CheckCircle className="w-5 h-5" />}
                      {activity.status === 'warning' && <Server className="w-5 h-5" />}
                      {activity.status === 'error' && <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{activity.task}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activity.startedAt ? new Date(activity.startedAt).toLocaleString('es-ES', { 
                          dateStyle: 'medium', timeStyle: 'short' 
                        }) : activity.time}
                      </p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-medium border bg-white">
                      {activity.status === 'success' && <span className="text-green-600 border-green-200">Completado</span>}
                      {activity.status === 'warning' && <span className="text-amber-600 border-amber-200">Pendiente</span>}
                      {activity.status === 'error' && <span className="text-red-600 border-red-200">Error</span>}
                    </div>
                  </div>
                ))}
                {allActivity.length === 0 && (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No hay actividad registrada</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
