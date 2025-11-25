interface OBDData {
  fuelLevel: number;
  engineTemp: number;
  speed: number;
  rpm: number;
  range: number;
}

class OBDService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<boolean> {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API не поддерживается в этом браузере');
      }

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'OBD' },
          { namePrefix: 'OBDII' },
          { namePrefix: 'ELM327' },
          { namePrefix: 'V-LINK' },
          { namePrefix: 'Vgate' }
        ],
        optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb']
      });

      if (!this.device.gatt) {
        throw new Error('GATT не поддерживается устройством');
      }

      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
      this.characteristic = await service.getCharacteristic('0000fff1-0000-1000-8000-00805f9b34fb');

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Ошибка подключения к OBD-II:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.device = null;
    this.characteristic = null;
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.device?.gatt?.connected === true;
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.characteristic) {
      throw new Error('Не подключено к OBD-II адаптеру');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(command + '\r');
    
    await this.characteristic.writeValue(data);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = await this.characteristic.readValue();
    const decoder = new TextDecoder();
    return decoder.decode(response);
  }

  private parseHexResponse(response: string): number {
    const cleaned = response.replace(/[\r\n\s>]/g, '');
    const match = cleaned.match(/41[0-9A-F]{2}([0-9A-F]+)/);
    if (match && match[1]) {
      return parseInt(match[1], 16);
    }
    return 0;
  }

  async getFuelLevel(): Promise<number> {
    try {
      const response = await this.sendCommand('012F');
      const value = this.parseHexResponse(response);
      return Math.round((value / 255) * 100);
    } catch (error) {
      console.error('Ошибка чтения уровня топлива:', error);
      return 0;
    }
  }

  async getEngineTemp(): Promise<number> {
    try {
      const response = await this.sendCommand('0105');
      const value = this.parseHexResponse(response);
      return value - 40;
    } catch (error) {
      console.error('Ошибка чтения температуры двигателя:', error);
      return 0;
    }
  }

  async getSpeed(): Promise<number> {
    try {
      const response = await this.sendCommand('010D');
      return this.parseHexResponse(response);
    } catch (error) {
      console.error('Ошибка чтения скорости:', error);
      return 0;
    }
  }

  async getRPM(): Promise<number> {
    try {
      const response = await this.sendCommand('010C');
      const value = this.parseHexResponse(response);
      return Math.round(value / 4);
    } catch (error) {
      console.error('Ошибка чтения оборотов двигателя:', error);
      return 0;
    }
  }

  async getAllData(): Promise<OBDData> {
    const fuelLevel = await this.getFuelLevel();
    const engineTemp = await this.getEngineTemp();
    const speed = await this.getSpeed();
    const rpm = await this.getRPM();
    
    const range = fuelLevel > 0 ? Math.round((fuelLevel / 100) * 600) : 0;

    return {
      fuelLevel,
      engineTemp,
      speed,
      rpm,
      range
    };
  }
}

export const obdService = new OBDService();
export type { OBDData };
