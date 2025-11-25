// Пример скетча для Arduino Nano
// Отправляет данные с датчиков в формате JSON через Serial порт

// Подключение библиотек (установите через Library Manager)
// #include <DHT.h>           // Для DHT22 (температура и влажность)
// #include <Wire.h>
// #include <Adafruit_BMP280.h> // Для BMP280 (давление)

// Настройка пинов
#define DHT_PIN 2
#define VOLTAGE_PIN A0
#define CUSTOM1_PIN A1
#define CUSTOM2_PIN A2

// DHT dht(DHT_PIN, DHT22);
// Adafruit_BMP280 bmp;

void setup() {
  Serial.begin(9600);
  
  // dht.begin();
  // bmp.begin();
  
  pinMode(VOLTAGE_PIN, INPUT);
  pinMode(CUSTOM1_PIN, INPUT);
  pinMode(CUSTOM2_PIN, INPUT);
}

void loop() {
  // Чтение данных с датчиков
  float temperature = 0; // dht.readTemperature();
  float humidity = 0;    // dht.readHumidity();
  float pressure = 0;    // bmp.readPressure() / 1000.0;
  
  // Чтение напряжения (0-5В -> 0-1023)
  float voltage = analogRead(VOLTAGE_PIN) * (5.0 / 1023.0);
  
  // Чтение пользовательских датчиков
  float custom1 = analogRead(CUSTOM1_PIN);
  float custom2 = analogRead(CUSTOM2_PIN);
  
  // Для теста - генерируем случайные значения
  temperature = 20.0 + random(-50, 150) / 10.0;
  humidity = 50.0 + random(-200, 200) / 10.0;
  pressure = 101.3 + random(-50, 50) / 10.0;
  voltage = 12.0 + random(-20, 20) / 10.0;
  custom1 = random(0, 1024);
  custom2 = random(0, 1024);
  
  // Формат 1: JSON (рекомендуется)
  Serial.print("{\"temp\":");
  Serial.print(temperature, 1);
  Serial.print(",\"hum\":");
  Serial.print(humidity, 1);
  Serial.print(",\"pres\":");
  Serial.print(pressure, 1);
  Serial.print(",\"volt\":");
  Serial.print(voltage, 2);
  Serial.print(",\"c1\":");
  Serial.print(custom1, 0);
  Serial.print(",\"c2\":");
  Serial.print(custom2, 0);
  Serial.println("}");
  
  // Формат 2: CSV (альтернатива)
  // Serial.print(temperature, 1); Serial.print(",");
  // Serial.print(humidity, 1); Serial.print(",");
  // Serial.print(pressure, 1); Serial.print(",");
  // Serial.print(voltage, 2); Serial.print(",");
  // Serial.print(custom1, 0); Serial.print(",");
  // Serial.println(custom2, 0);
  
  delay(1000); // Отправка каждую секунду
}

// Команды от браузера (опционально)
void serialEvent() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "RESET") {
      // Сброс каких-то параметров
      Serial.println("OK");
    }
  }
}
