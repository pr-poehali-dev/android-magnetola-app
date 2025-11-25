import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { obdService } from '@/lib/obdService';

interface DoorStatus {
  frontLeft: boolean;
  frontRight: boolean;
  rearLeft: boolean;
  rearRight: boolean;
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
        return;
      }

      try {
        const data = await obdService.getAllData();
        setFuelLevel(data.fuelLevel);
        setEngineTemp(data.engineTemp);
        setRange(data.range);
        setSpeed(data.speed);
        setRpm(data.rpm);
      } catch (error) {
        console.error('Ошибка чтения данных OBD-II:', error);
      }
    }, 2000);
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
          <TabsList className="grid w-full grid-cols-2 h-16 mb-6 bg-card">
            <TabsTrigger value="dashboard" className="text-base h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Icon name="Gauge" size={20} className="mr-2" />
              Панель
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