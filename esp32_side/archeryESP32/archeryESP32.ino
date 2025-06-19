
#include <WiFiManager.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <MPU9250.h>

// Налаштування WebSocket
WebSocketsClient webSocket;

// MPU9250
MPU9250Setting setting;
MPU9250 mpu;
bool isSendingData = false;
float data[6];
unsigned long lastSend = 0;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) 
{
    switch(type) 
    {
        case WStype_CONNECTED:
            Serial.println("connect to WebSocket");
            break;
        case WStype_DISCONNECTED:
            Serial.println("disconnect from WebSocket");
            break;
        case WStype_PONG:
            Serial.println("PONG received from server");
            break;

        case WStype_TEXT:
            String command = String((char*)payload);
            if (command == "START") 
            {
                isSendingData = true;
                Serial.println("command START received.");
            } 
            else if (command == "STOP") 
            {
                isSendingData = false;
                Serial.println("command STOP received.");
            }
            break;
    }
}

void setup() {
    Serial.begin(115200);

    // Підключення до Wi-Fi
    WiFiManager wifiManager;
    if (!wifiManager.autoConnect("BowTrackerAP", "12345678")) 
    {
        Serial.println("Failed to connect to WiFi");
        return;
    }
    Serial.println("Connected to WiFi");
    Serial.print("Wifi RSSI: ");
    Serial.println(WiFi.RSSI());

    // Ініціалізація WebSocket
    webSocket.begin("13.53.34.80", 5000, "/esp");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(10000);
    
    webSocket.enableHeartbeat(20000, 3000, 2); 

    // Налаштування MPU9250
    Wire.begin();
    delay(5000);

    setting.accel_fs_sel = ACCEL_FS_SEL::A4G;
    setting.gyro_fs_sel = GYRO_FS_SEL::G250DPS;
    setting.mag_output_bits = MAG_OUTPUT_BITS::M16BITS;
    setting.fifo_sample_rate = FIFO_SAMPLE_RATE::SMPL_125HZ;
    setting.gyro_fchoice = 0x03;
    setting.gyro_dlpf_cfg = GYRO_DLPF_CFG::DLPF_41HZ;
    setting.accel_fchoice = 0x01;
    setting.accel_dlpf_cfg = ACCEL_DLPF_CFG::DLPF_45HZ;
    mpu.setup(0x68, setting);
    Serial.println("MPU9250 CONFIGURED!");
    
}

void loop() {
    webSocket.loop();
    if (mpu.available())
    {
        mpu.update_accel_gyro();
    }
    
    unsigned long now = millis();
    if (isSendingData && (now - lastSend) > 25) 
    {
        // Оновлення та відправка даних
        data[0] = mpu.getAccX() * 9.80665;
        data[1] = mpu.getAccY() * 9.80665;
        data[2] = mpu.getAccZ() * 9.80665;
        data[3] = mpu.getGyroX() / 131.0;
        data[4] = mpu.getGyroY() / 131.0;
        data[5] = mpu.getGyroZ() / 131.0;

        webSocket.sendBIN((uint8_t*)data, sizeof(data));
        lastSend = now;
    }
}

