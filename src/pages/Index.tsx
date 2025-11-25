import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { obdService } from '@/lib/obdService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface DoorStatus {
  frontLeft: boolean;
  frontRight: boolean;
  rearLeft: boolean;
  rearRight: boolean;
}

interface TripRecord {
  timestamp: number;
  distance: number;
  avgSpeed: number;
  maxSpeed: number;
  fuelUsed: number;
  avgConsumption: number;
  duration: number;
}

interface DataPoint {
  time: string;
  fuel: number;
  speed: number;
  temp: number;
}

const Index = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fuelLevel, setFuelLevel] = useState(65);
  const [range, setRange] = useState(420);
  const [engineTemp, setEngineTemp] = useState(87);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [rpm, setRpm] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<DataPoint[]>([]);
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([
    {
      timestamp: Date.now() - 86400000 * 2,
      distance: 45.3,
      avgSpeed: 62,
      maxSpeed: 110,
      fuelUsed: 4.2,
      avgConsumption: 9.3,
      duration: 42
    },
    {
      timestamp: Date.now() - 86400000,
      distance: 128.7,
      avgSpeed: 85,
      maxSpeed: 130,
      fuelUsed: 11.8,
      avgConsumption: 9.2,
      duration: 91
    },
    {
      timestamp: Date.now() - 3600000 * 4,
      distance: 22.5,
      avgSpeed: 48,
      maxSpeed: 90,
      fuelUsed: 2.1,
      avgConsumption: 9.3,
      duration: 28
    }
  ]);
  const [tripStartTime, setTripStartTime] = useState(0);
  const [tripStartFuel, setTripStartFuel] = useState(0);
  const [tripMaxSpeed, setTripMaxSpeed] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [doors, setDoors] = useState<DoorStatus>({
    frontLeft: false,
    frontRight: false,
    rearLeft: false,
    rearRight: true,
  });
  
  const [settings, setSettings] = useState({
    autoLock: true,
    parkingSensors: true,
    climateControl: false,
    startStop: true,
  });

  const allDoorsClosed = !Object.values(doors).some(Boolean);

  const toggleDoor = (door: keyof DoorStatus) => {
    setDoors(prev => ({ ...prev, [door]: !prev[door] }));
  };

  const connectToOBD = async () => {
    setIsConnecting(true);
    const success = await obdService.connect();
    
    if (success) {
      setIsConnected(true);
      toast({
        title: 'Подключено',
        description: 'OBD-II адаптер успешно подключен',
      });
      startDataPolling();
    } else {
      toast({
        title: 'Ошибка подключения',
        description: 'Не удалось подключиться к OBD-II адаптеру',
        variant: 'destructive',
      });
    }
    setIsConnecting(false);
  };

  const disconnectFromOBD = async () => {
    await obdService.disconnect();
    setIsConnected(false);
    toast({
      title: 'Отключено',
      description: 'OBD-II адаптер отключен',
    });
  };

  const startDataPolling = () => {
    const interval = setInterval(async () => {
      if (!obdService.getConnectionStatus()) {
        clearInterval(interval);
        setIsConnected(false);
        if (isRecording) {
          stopTrip();
        }
        return;
      }

      try {
        const data = await obdService.getAllData();
        setFuelLevel(data.fuelLevel);
        setEngineTemp(data.engineTemp);
        setRange(data.range);
        setSpeed(data.speed);
        setRpm(data.rpm);

        if (isRecording) {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          setCurrentTrip(prev => [
            ...prev,
            {
              time: timeStr,
              fuel: data.fuelLevel,
              speed: data.speed,
              temp: data.engineTemp
            }
          ].slice(-30));

          if (data.speed > tripMaxSpeed) {
            setTripMaxSpeed(data.speed);
          }

          setTripDistance(prev => prev + (data.speed / 1800));
        }
      } catch (error) {
        console.error('Ошибка чтения данных OBD-II:', error);
      }
    }, 2000);
  };

  const startTrip = () => {
    setIsRecording(true);
    setCurrentTrip([]);
    setTripStartTime(Date.now());
    setTripStartFuel(fuelLevel);
    setTripMaxSpeed(0);
    setTripDistance(0);
    toast({
      title: 'Запись начата',
      description: 'История поездки записывается',
    });
  };

  const stopTrip = () => {
    if (!isRecording) return;

    const duration = Math.round((Date.now() - tripStartTime) / 60000);
    const fuelUsed = ((tripStartFuel - fuelLevel) / 100) * 60;
    const avgSpeed = currentTrip.length > 0 
      ? Math.round(currentTrip.reduce((sum, d) => sum + d.speed, 0) / currentTrip.length)
      : 0;
    const avgConsumption = tripDistance > 0 ? (fuelUsed / tripDistance) * 100 : 0;

    const newTrip: TripRecord = {
      timestamp: Date.now(),
      distance: Math.round(tripDistance * 10) / 10,
      avgSpeed,
      maxSpeed: tripMaxSpeed,
      fuelUsed: Math.round(fuelUsed * 10) / 10,
      avgConsumption: Math.round(avgConsumption * 10) / 10,
      duration
    };

    setTripHistory(prev => [newTrip, ...prev].slice(0, 10));
    setIsRecording(false);
    setCurrentTrip([]);
    
    toast({
      title: 'Поездка завершена',
      description: `Пройдено ${newTrip.distance} км, расход ${newTrip.avgConsumption} л/100км`,
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 24) {
      return `${hours} ч назад`;
    }
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours} ч ${mins} мин` : `${mins} мин`;
  };

  useEffect(() => {
    return () => {
      if (isConnected) {
        obdService.disconnect();
      }
    };
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Icon name="Car" size={32} />
            Автомобиль
          </h1>
          {!isConnected ? (
            <Button 
              onClick={connectToOBD} 
              disabled={isConnecting}
              size="lg"
              className="h-14 px-6 text-base"
            >
              <Icon name="Bluetooth" size={20} className="mr-2" />
              {isConnecting ? 'Подключение...' : 'Подключить OBD-II'}
            </Button>
          ) : (
            <Button 
              onClick={disconnectFromOBD}
              variant="outline"
              size="lg"
              className="h-14 px-6 text-base"
            >
              <Icon name="BluetoothConnected" size={20} className="mr-2" />
              Отключить
            </Button>
          )}
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-16 mb-6 bg-card">
            <TabsTrigger value="dashboard" className="text-base h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Icon name="Gauge" size={20} className="mr-2" />
              Панель
            </TabsTrigger>
            <TabsTrigger value="trips" className="text-base h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Icon name="Map" size={20} className="mr-2" />
              Поездки
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-base h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Icon name="Settings" size={20} className="mr-2" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 animate-fade-in">
            {isConnected && (
              <Card className="p-4 bg-primary/10 border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                    <span className="text-sm font-medium">OBD-II подключен</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Скорость: </span>
                      <span className="font-bold">{speed} км/ч</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Обороты: </span>
                      <span className="font-bold">{rpm} об/мин</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 bg-card border-border hover:border-primary transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Icon name="Fuel" size={32} className="text-primary" />
                  <span className="text-5xl font-bold">{fuelLevel}%</span>
                </div>
                <h3 className="text-lg text-muted-foreground mb-3">Топливо</h3>
                <Progress value={fuelLevel} className="h-3" />
              </Card>

              <Card className="p-6 bg-card border-border hover:border-primary transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Icon name="Route" size={32} className="text-primary" />
                  <span className="text-5xl font-bold">{range}</span>
                </div>
                <h3 className="text-lg text-muted-foreground">км запас хода</h3>
              </Card>

              <Card className="p-6 bg-card border-border hover:border-primary transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Icon name="Thermometer" size={32} className="text-primary" />
                  <span className="text-5xl font-bold">{engineTemp}°</span>
                </div>
                <h3 className="text-lg text-muted-foreground">Температура двигателя</h3>
              </Card>
            </div>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-6">
                <Icon 
                  name={allDoorsClosed ? "Lock" : "LockOpen"} 
                  size={28} 
                  className={allDoorsClosed ? "text-primary" : "text-destructive"} 
                />
                <h2 className="text-2xl font-bold">
                  {allDoorsClosed ? 'Все двери закрыты' : 'Открыты двери'}
                </h2>
              </div>

              <div className="relative w-full max-w-2xl mx-auto">
                <div className="aspect-[2/1] relative">
                  <svg viewBox="0 0 400 200" className="w-full h-full">
                    <rect x="80" y="40" width="240" height="120" rx="20" fill="currentColor" className="text-secondary" />
                    
                    <rect x="60" y="50" width="20" height="40" rx="4" 
                      fill="currentColor" 
                      className={doors.frontLeft ? "text-destructive animate-pulse" : "text-muted"} 
                      onClick={() => toggleDoor('frontLeft')}
                      style={{ cursor: 'pointer' }}
                    />
                    <rect x="320" y="50" width="20" height="40" rx="4" 
                      fill="currentColor" 
                      className={doors.frontRight ? "text-destructive animate-pulse" : "text-muted"} 
                      onClick={() => toggleDoor('frontRight')}
                      style={{ cursor: 'pointer' }}
                    />
                    <rect x="60" y="110" width="20" height="40" rx="4" 
                      fill="currentColor" 
                      className={doors.rearLeft ? "text-destructive animate-pulse" : "text-muted"} 
                      onClick={() => toggleDoor('rearLeft')}
                      style={{ cursor: 'pointer' }}
                    />
                    <rect x="320" y="110" width="20" height="40" rx="4" 
                      fill="currentColor" 
                      className={doors.rearRight ? "text-destructive animate-pulse" : "text-muted"} 
                      onClick={() => toggleDoor('rearRight')}
                      style={{ cursor: 'pointer' }}
                    />
                    
                    <ellipse cx="120" cy="170" rx="18" ry="18" fill="currentColor" className="text-muted-foreground" />
                    <ellipse cx="280" cy="170" rx="18" ry="18" fill="currentColor" className="text-muted-foreground" />
                    <ellipse cx="120" cy="30" rx="18" ry="18" fill="currentColor" className="text-muted-foreground" />
                    <ellipse cx="280" cy="30" rx="18" ry="18" fill="currentColor" className="text-muted-foreground" />
                    
                    <path d="M 120 60 L 280 60 L 280 140 L 120 140 Z" fill="currentColor" className="text-card" opacity="0.3" />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className={`p-4 rounded-lg ${doors.frontLeft ? 'bg-destructive/20' : 'bg-secondary'}`}>
                    <p className="text-sm text-muted-foreground">Передняя левая</p>
                    <p className="text-xl font-bold">{doors.frontLeft ? 'Открыта' : 'Закрыта'}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${doors.frontRight ? 'bg-destructive/20' : 'bg-secondary'}`}>
                    <p className="text-sm text-muted-foreground">Передняя правая</p>
                    <p className="text-xl font-bold">{doors.frontRight ? 'Открыта' : 'Закрыта'}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${doors.rearLeft ? 'bg-destructive/20' : 'bg-secondary'}`}>
                    <p className="text-sm text-muted-foreground">Задняя левая</p>
                    <p className="text-xl font-bold">{doors.rearLeft ? 'Открыта' : 'Закрыта'}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${doors.rearRight ? 'bg-destructive/20' : 'bg-secondary'}`}>
                    <p className="text-sm text-muted-foreground">Задняя правая</p>
                    <p className="text-xl font-bold">{doors.rearRight ? 'Открыта' : 'Закрыта'}</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="trips" className="space-y-6 animate-fade-in">
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Icon name="Route" size={28} className="text-primary" />
                  <h2 className="text-2xl font-bold">Текущая поездка</h2>
                </div>
                {isConnected && (
                  !isRecording ? (
                    <Button onClick={startTrip} size="lg" className="h-14 px-6">
                      <Icon name="Play" size={20} className="mr-2" />
                      Начать запись
                    </Button>
                  ) : (
                    <Button onClick={stopTrip} variant="destructive" size="lg" className="h-14 px-6">
                      <Icon name="Square" size={20} className="mr-2" />
                      Остановить
                    </Button>
                  )
                )}
              </div>

              {isRecording && currentTrip.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground">Пройдено</p>
                      <p className="text-3xl font-bold">{tripDistance.toFixed(1)} км</p>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground">Макс. скорость</p>
                      <p className="text-3xl font-bold">{tripMaxSpeed} км/ч</p>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground">Время в пути</p>
                      <p className="text-3xl font-bold">{formatDuration(Math.round((Date.now() - tripStartTime) / 60000))}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">График скорости</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={currentTrip}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Area type="monotone" dataKey="speed" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">График топлива и температуры</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={currentTrip}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line type="monotone" dataKey="fuel" stroke="hsl(var(--primary))" strokeWidth={2} name="Топливо %" />
                        <Line type="monotone" dataKey="temp" stroke="hsl(var(--destructive))" strokeWidth={2} name="Температура °C" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Icon name="MapPin" size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg text-muted-foreground">
                    {isConnected ? 'Нажмите "Начать запись" для отслеживания поездки' : 'Подключите OBD-II для записи поездок'}
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-6">
                <Icon name="History" size={28} className="text-primary" />
                <h2 className="text-2xl font-bold">История поездок</h2>
              </div>

              <div className="space-y-4">
                {tripHistory.map((trip, index) => (
                  <div key={index} className="p-5 bg-secondary rounded-lg border border-border hover:border-primary transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Icon name="Calendar" size={20} className="text-primary" />
                        <span className="text-lg font-semibold">{formatDate(trip.timestamp)}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDuration(trip.duration)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Расстояние</p>
                        <p className="text-xl font-bold">{trip.distance} км</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Ср. скорость</p>
                        <p className="text-xl font-bold">{trip.avgSpeed} км/ч</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Макс. скорость</p>
                        <p className="text-xl font-bold">{trip.maxSpeed} км/ч</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Топливо</p>
                        <p className="text-xl font-bold">{trip.fuelUsed} л</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Расход</p>
                        <p className="text-xl font-bold text-primary">{trip.avgConsumption} л/100км</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 animate-fade-in">
            <Card className="p-6 bg-card border-border">
              <div className="space-y-6">
                <div className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-4">
                    <Icon name="Lock" size={24} className="text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold">Автоблокировка</h3>
                      <p className="text-sm text-muted-foreground">Блокировать двери при движении</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings.autoLock} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoLock: checked }))}
                    className="scale-150"
                  />
                </div>

                <div className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-4">
                    <Icon name="Radar" size={24} className="text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold">Парктроник</h3>
                      <p className="text-sm text-muted-foreground">Датчики парковки</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings.parkingSensors} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, parkingSensors: checked }))}
                    className="scale-150"
                  />
                </div>

                <div className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-4">
                    <Icon name="Wind" size={24} className="text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold">Климат-контроль</h3>
                      <p className="text-sm text-muted-foreground">Автоматическая регулировка</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings.climateControl} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, climateControl: checked }))}
                    className="scale-150"
                  />
                </div>

                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <Icon name="Power" size={24} className="text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold">Старт-стоп</h3>
                      <p className="text-sm text-muted-foreground">Автоотключение двигателя</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings.startStop} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, startStop: checked }))}
                    className="scale-150"
                  />
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;