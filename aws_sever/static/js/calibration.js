const socket = new WebSocket("ws://13.53.34.80/ws");

document.addEventListener('DOMContentLoaded', () => {
    const indicator = document.getElementById('indicator');
    const blink = document.getElementById('blink');
    const statusText = document.getElementById('status');

    if (!indicator || !blink || !statusText) {
        console.error('Елемент статусу калібрування не знайдено');
        return;
    }

    socket.onopen = function () {
        console.log("WebSocket з'єднання встановлено");
    };

    function setOnline() {
        indicator.style.backgroundColor = '#0fcc45';
        blink.style.backgroundColor = '#0fcc45';
        statusText.textContent = 'ESP32 Online';
        statusText.style.color = '#0fcc45';
    }

    function setOffline() {
        indicator.style.backgroundColor = '#ff3b3b';
        blink.style.backgroundColor = '#ff3b3b';
        statusText.textContent = 'ESP32 Offline';
        statusText.style.color = '#ff3b3b';
    }

    socket.onmessage = function (event) {
        if (event.data === 'ESP32 підключено') {
            setOnline();
            return;
        } else if (event.data === 'ESP32 відключено') {
            setOffline();
            return;
        }

        if (event.data === 'Calibration Started') {
            calibrationStatus.textContent = "Калібрування розпочато";
        } else if (event.data === 'Calibration Stopped') {
            calibrationStatus.textContent = "Калібрування зупинено";
        } else {
            console.log("Отримано дані:", event.data);
        }
        
    };

    document.querySelector('.start').addEventListener('click', () => sendCommand('START_CALIBRATE'));
    document.querySelector('.stop').addEventListener('click', () => sendCommand('STOP'));

    socket.onerror = function(error) {
        console.error("Помилка WebSocket:", error);
    };
});
