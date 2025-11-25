interface ArduinoData {
  temperature: number;
  humidity: number;
  pressure: number;
  voltage: number;
  custom1: number;
  custom2: number;
}

class ArduinoService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private isConnected: boolean = false;
  private buffer: string = '';
  private dataCallback: ((data: ArduinoData) => void) | null = null;

  async connect(): Promise<boolean> {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API не поддерживается в этом браузере');
      }

      this.port = await (navigator as any).serial.requestPort({
        filters: [
          { usbVendorId: 0x2341 },
          { usbVendorId: 0x1A86 }
        ]
      });

      await this.port.open({ baudRate: 9600 });
      this.isConnected = true;
      this.startReading();
      return true;
    } catch (error) {
      console.error('Ошибка подключения к Arduino:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }

    this.isConnected = false;
    this.buffer = '';
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.port !== null;
  }

  onData(callback: (data: ArduinoData) => void): void {
    this.dataCallback = callback;
  }

  private async startReading(): Promise<void> {
    if (!this.port?.readable) return;

    this.reader = this.port.readable.getReader();

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        this.buffer += text;

        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          this.parseLine(line.trim());
        }
      }
    } catch (error) {
      console.error('Ошибка чтения данных Arduino:', error);
      this.isConnected = false;
    } finally {
      this.reader?.releaseLock();
    }
  }

  private parseLine(line: string): void {
    if (!line || !this.dataCallback) return;

    try {
      const data = JSON.parse(line);
      
      const arduinoData: ArduinoData = {
        temperature: data.temp || 0,
        humidity: data.hum || 0,
        pressure: data.pres || 0,
        voltage: data.volt || 0,
        custom1: data.c1 || 0,
        custom2: data.c2 || 0
      };

      this.dataCallback(arduinoData);
    } catch (error) {
      const parts = line.split(',');
      if (parts.length >= 4) {
        const arduinoData: ArduinoData = {
          temperature: parseFloat(parts[0]) || 0,
          humidity: parseFloat(parts[1]) || 0,
          pressure: parseFloat(parts[2]) || 0,
          voltage: parseFloat(parts[3]) || 0,
          custom1: parseFloat(parts[4]) || 0,
          custom2: parseFloat(parts[5]) || 0
        };

        this.dataCallback(arduinoData);
      }
    }
  }

  async sendCommand(command: string): Promise<void> {
    if (!this.port?.writable) {
      throw new Error('Arduino не подключен');
    }

    const writer = this.port.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(command + '\n'));
    writer.releaseLock();
  }
}

export const arduinoService = new ArduinoService();
export type { ArduinoData };
