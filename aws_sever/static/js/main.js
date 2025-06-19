const socket = new WebSocket("ws://13.53.34.80/ws");

// Функція для надсилання команд
function sendCommand(command) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(command);
        console.log(`Команда ${command} відправлена серверу`);
    } else {
        console.error("WebSocket не готовий");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const indicator = document.getElementById('indicator');
    const blink = document.getElementById('blink');
    const statusText = document.getElementById('status');
    const accelCtx = document.getElementById('accelChart')?.getContext('2d');
    const gyroCtx = document.getElementById('gyroChart')?.getContext('2d');
    const systemState = document.getElementById('systemState');
    const menuBtn = document.querySelector('.menu-btn');
    const wrapper = document.querySelector('.wrapper');

    if (!indicator || !blink || !statusText || !accelCtx || !gyroCtx || !systemState || !wrapper || !menuBtn) {
        console.error("Елементи DOM для статусу або графіків не знайдені");
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

    const accelData = {
        labels: [],
        datasets: [
            {
                label: 'Accel X',
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                data: []
            },
            {
                label: 'Accel Y',
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                data: []
            },
            {
                label: 'Accel Z',
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                data: []
            }
        ]
    };

    const gyroData = {
        labels: [],
        datasets: [
            {
                label: 'Gyro X',
                borderColor: 'rgb(255, 205, 86)',
                backgroundColor: 'rgba(255, 205, 86, 0.2)',
                data: []
            },
            {
                label: 'Gyro Y',
                borderColor: 'rgb(201, 203, 207)',
                backgroundColor: 'rgba(201, 203, 207, 0.2)',
                data: []
            },
            {
                label: 'Gyro Z',
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                data: []
            }
        ]
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        onResize: (chart, size) => {
            console.log(`Chart resized to width: ${size.width}, height: ${size.height}`);
        },
        plugins: {
            legend: {
                display: true,
                position: 'top'
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time (s)'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Value'
                }
            }
        }
    };

    // Конфіг для акселератора
    const accelConfig = {
        type: 'line',
        data: accelData,
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Acceleration (m/s²)'
                    }
                }
            }
        }
    };

    // Конфіг для гіроскопу
    const gyroConfig = {
        type: 'line',
        data: gyroData,
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Rotation (°/s)'
                    }
                }
            }
        }
    };

    const accelChart = new Chart(accelCtx, accelConfig);
    const gyroChart = new Chart(gyroCtx, gyroConfig);

    let accelBufferedData = [];
    let gyroBufferedData = [];

    const UPDATE_INTERVAL = 25; // оновлювати графіки

    function applyAccelData() {
        if (accelBufferedData.length > 0) {
            for (const point of accelBufferedData) {
                const { time, accX, accY, accZ } = point;
                if (accelData.labels.length > 100) {
                    accelData.labels.shift();
                    accelData.datasets[0].data.shift();
                    accelData.datasets[1].data.shift();
                    accelData.datasets[2].data.shift();
                }
                accelData.labels.push(time);
                accelData.datasets[0].data.push(accX);
                accelData.datasets[1].data.push(accY);
                accelData.datasets[2].data.push(accZ);
            }

            accelBufferedData = [];
            accelChart.update();
        }
    }

    function applyGyroData() {
        if (gyroBufferedData.length > 0) {
            for (const point of gyroBufferedData) {
                const { time, gyroX, gyroY, gyroZ } = point;
                if (gyroData.labels.length > 100) {
                    gyroData.labels.shift();
                    gyroData.datasets[0].data.shift();
                    gyroData.datasets[1].data.shift();
                    gyroData.datasets[2].data.shift();
                }
                gyroData.labels.push(time);
                gyroData.datasets[0].data.push(gyroX);
                gyroData.datasets[1].data.push(gyroY);
                gyroData.datasets[2].data.push(gyroZ);
            }
            gyroBufferedData = [];
            gyroChart.update();
        }
    }

    setInterval(() => {
        applyAccelData();
        applyGyroData();
    }, UPDATE_INTERVAL);

    socket.onmessage = function(event) {
        if (event.data === 'ESP32 підключено') {
            setOnline();
            return;
        } else if (event.data === 'ESP32 відключено') {
            setOffline();
            return;
        }

        try {
            const parsedData = JSON.parse(event.data);
            const time = new Date().toLocaleTimeString();

            // Записуємо дані акселерометра
            accelBufferedData.push({
                time: time,
                accX: parsedData.accX,
                accY: parsedData.accY,
                accZ: parsedData.accZ
            });

            // Записуємо дані гіроскопа
            gyroBufferedData.push({
                time: time,
                gyroX: parsedData.gyroX,
                gyroY: parsedData.gyroY,
                gyroZ: parsedData.gyroZ
            });

            if (parsedData.state) {
                if (parsedData.state === "REST") {
                    systemState.textContent = "Система: Спокій";
                    systemState.style.color = "green";
                } else if (parsedData.state === "ACTIVE") {
                    systemState.textContent = "Система: Активна";
                    systemState.style.color = "red";
                }
            } 

        } catch (error) {
            console.error("Неправильний формат даних:", event.data);
        }
    };

    socket.onerror = function(error) {
        console.error("Помилка WebSocket:", error);
    };
});