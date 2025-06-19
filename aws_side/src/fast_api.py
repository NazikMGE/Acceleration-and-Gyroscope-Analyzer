from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import time
import struct
import numpy as np
import logging
import queue
from logging.handlers import QueueHandler, QueueListener

# Глобальні змінні для стабільності
gravity = 9.80665
window_size = 20
acc_threshold = 0.01
gyro_threshold = 0.05
acc_buffer = []
gyro_buffer = []

# Налаштування черги для логування
log_queue = queue.Queue()
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
queue_handler = QueueHandler(log_queue)

# Створюємо логер
logger = logging.getLogger("my_async_logger")
logger.setLevel(logging.INFO)
logger.addHandler(queue_handler)

# Додаємо QueueListener для обробки логів
listener = QueueListener(log_queue, console_handler)
listener.start()

# Замінюємо функцію log_with_time на таку, що використовує logger
def log_with_time(message: str):
    # Додаємо timestamp до повідомлення:
    current_time = time.strftime('%Y-%m-%d %H:%M:%S')
    logger.info(f"[{current_time}] {message}")

def update_stability(acc, gyro):
    global acc_buffer, gyro_buffer

    # Корекція гравітації
    acc = np.array(acc) - np.array([0, 0, gravity])
    gyro = np.array(gyro)
    
    # Оновлення буферів
    acc_buffer.append(acc)
    gyro_buffer.append(gyro)

    # Підтримка розміру буфера
    if len(acc_buffer) > window_size:
        acc_buffer.pop(0)
    if len(gyro_buffer) > window_size:
        gyro_buffer.pop(0)

    # Перевірка, чи буфери заповнені
    if len(acc_buffer) == window_size and len(gyro_buffer) == window_size:
        acc_var = np.var(acc_buffer, axis=0).mean()
        gyro_var = np.var(gyro_buffer, axis=0).mean()

        # Визначення стану
        if acc_var < acc_threshold and gyro_var < gyro_threshold:
            return "REST"
        else:
            return "ACTIVE"
    else:
        return "Collecting data..."

app = FastAPI()

clients = []  # Список підключених веб-клієнтів
esp_ws = None  # WebSocket-з'єднання для ESP32

@app.websocket("/esp")
async def esp_endpoint(websocket: WebSocket):
    global esp_ws
    await websocket.accept()
    esp_ws = websocket
    log_with_time("ESP32 підключено")

    # Сповіщуємо всіх клієнтів про підключення ESP32
    for client_ws in clients:
        await client_ws.send_text("ESP32 підключено")

    try:
        while True:
            # Отримуємо бінарні дані від ESP32
            binary_data = await websocket.receive_bytes()

            # Розпаковуємо дані у масив з 6 значень float
            try:
                unpacked_data = struct.unpack('ffffff', binary_data)
                # log_with_time(f"Дані від ESP32: {unpacked_data}")

                # Передаємо дані до функції аналізу стабільності
                acc = [unpacked_data[0], unpacked_data[1], unpacked_data[2]]
                gyro = [unpacked_data[3], unpacked_data[4], unpacked_data[5]]
                stability_status = update_stability(acc, gyro)
                
                # log_with_time(f"Стан стабільності: {stability_status}")
                
                # Створюємо об'єкт для передачі клієнтам
                json_data = {
                    "accX": unpacked_data[0],
                    "accY": unpacked_data[1],
                    "accZ": unpacked_data[2],
                    "gyroX": unpacked_data[3],
                    "gyroY": unpacked_data[4],
                    "gyroZ": unpacked_data[5],
                    "state": stability_status,
                }

                # Пересилаємо дані всім підключеним клієнтам
                for client in clients:
                    await client.send_json(json_data)

            except struct.error as e:
                log_with_time(f"Помилка розпаковки даних: {e}")

    except WebSocketDisconnect:
        log_with_time("ESP32 відключено")
        esp_ws = None
        disconnected_clients = []
        for client_ws in clients:
            try:
                await client_ws.send_text("ESP32 відключено")
            except WebSocketDisconnect:
                disconnected_clients.append(client_ws)
        
        for client_ws in disconnected_clients:
            clients.remove(client_ws)

@app.websocket("/ws")
async def websocket(websocket: WebSocket):
    global esp_ws
    await websocket.accept()
    clients.append(websocket)
    log_with_time("Веб-клієнт підключився")

    # Передаємо стан ESP32 новому клієнту
    if esp_ws is not None:
        await websocket.send_text("ESP32 підключено")
    else:
        await websocket.send_text("ESP32 відключено")

    try:
        while True:
            data = await websocket.receive_text()
            log_with_time(f"Отримано від веб-клієнта: {data}")
            if data in {"START", "STOP"} and esp_ws:
                await esp_ws.send_text(data)
                log_with_time(f"Команда ESP32: {data}")
    except WebSocketDisconnect:
        if websocket in clients:  # Перевірка перед видаленням
            clients.remove(websocket)
        log_with_time("Веб-клієнт відключився")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)