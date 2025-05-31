const dashboard = document.getElementById("dashboard");
const charts = {};
let lastValues = {};  // Store last known values for each sensor

// **🔹 Google Sheets API Details**
const sheetID = "1QxvZ5AuXYkw9KidkqOVq25xiQRRigu9eT5FQEWPj_Kw";  // Replace with your actual Sheet ID
const apiKey = "AIzaSyAzdZ7pmQcAX8rwS6WyO0qIVXZpj9ASxgU";  // Replace with your actual API Key
const sheetName = "DataCollector";  // Your Sheet Name
const range = `${sheetName}!A:I`;  // Fetch all rows dynamically

const sensors = [];

// **🔹 Create Gauge Elements**
function createGauge(sensor) {
    // Gauge Box
    const container = document.createElement("div");
    container.classList.add("gauge-container");
    container.innerHTML = `
        <div class="gauge-title">${sensor.label}</div>
        <canvas id="${sensor.id}" width="150" height="80"></canvas>
        <div class="gauge-value" id="${sensor.id}-value">0 ${sensor.unit}</div>
    `;
    dashboard.appendChild(container);

    // Toggle Switch (added separately to toggle panel)
    const togglePanel = document.getElementById("toggle-panel");
    const toggleContainer = document.createElement("div");
    toggleContainer.classList.add("toggle-item");
    toggleContainer.innerHTML = `
        <label class="toggle-label">Relay ${togglePanel.children.length + 1}</label>

        <label class="switch">
            <input type="checkbox" id="${sensor.id}-toggle" checked>
            <span class="slider round"></span>
        </label>
    `;
    togglePanel.appendChild(toggleContainer);

    const ctx = document.getElementById(sensor.id).getContext("2d");
    charts[sensor.id] = {
        ctx,
        valueId: `${sensor.id}-value`,
        color: sensor.color,
        min: sensor.min,
        max: sensor.max,
        currentValue: 0,
        unit: sensor.unit
    };
}



// **🔹 Fetch Sensor Data from Google Sheets**
async function fetchSensorData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${range}?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values) {
            console.error("❌ Google Sheets API returned no data. Check Sheet ID & permissions.");
            return;
        }

        const headers = data.values[0]; // Sensor names (Row 1)
        const minValues = data.values[1]; // Min values (Row 2)
        const maxValues = data.values[2]; // Max values (Row 3)
        const allRows = data.values.slice(3); // Sensor data rows (excluding headers)

        // **Find the last updated value for each sensor**
        let latestValues = {};
        headers.forEach((sensorName, index) => {
            if (index === 0 || !sensorName) return; // Skip Timestamp column

            for (let i = allRows.length - 1; i >= 0; i--) {
                if (allRows[i][index]) {
                    latestValues[sensorName] = parseFloat(allRows[i][index]);
                    break;
                }
            }

            // If no value was found, use the last known value
            if (!latestValues[sensorName]) {
                latestValues[sensorName] = lastValues[sensorName] || 0;
            }

            lastValues[sensorName] = latestValues[sensorName]; // Store the latest value
        });

        // **Update sensor min-max values & latest readings**
        sensors.length = 0;
        headers.forEach((sensorName, index) => {
            if (index === 0 || !sensorName) return; // Skip Timestamp column

            const minValue = parseFloat(minValues[index]) || 0;
            const maxValue = parseFloat(maxValues[index]) || 100;
            const sensorValue = latestValues[sensorName];

            const sensorId = sensorName.replace(/\s+/g, "").toLowerCase();
            const sensor = {
                id: sensorId,
                label: sensorName,
                color: getColor(index),
                min: minValue,
                max: maxValue,
                unit: getUnit(sensorName)
            };

            sensors.push(sensor);
            if (!charts[sensor.id]) createGauge(sensor);
            animateGauge(sensor.id, sensorValue);
        });

        console.log("✅ Min, Max & Latest values updated from Google Sheets");

    } catch (error) {
        console.error("❌ Error fetching sensor data:", error);
    }
}

// **🔹 Assign Colors Based on Index**
function getColor(index) {
    const colors = ["#FF5733", "#FFA500", "#17A2B8", "#8E44AD", "#E67E22", "#27AE60", "#3498DB"];
    return colors[index % colors.length];
}

// **🔹 Assign Units Based on Sensor Name**
function getUnit(sensorName) {
    const units = {
        "Current Sensor": "A",
        "Temperature Sensor": "°C",
        "Humidity Sensor": "%",
        "Vibration Sensor": "m/s²",
        "Pressure Sensor": "Pa",
        "RPM Sensor": "RPM",
        "Water Flow Sensor": "L/min"
    };
    return units[sensorName] || "";
}

// **🔹 Smooth Animation Function**
function animateGauge(sensorId, newValue) {
    let startTime = null;
    const duration = 500;
    const startValue = charts[sensorId].currentValue;
    const valueChange = newValue - startValue;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedValue = startValue + valueChange * (progress * (2 - progress));

        drawGauge(sensorId, easedValue);

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            charts[sensorId].currentValue = newValue;
        }
    }

    requestAnimationFrame(step);
}

// **🔹 Draw Gauge Function**
function drawGauge(sensorId, value) {
    const { ctx, valueId, color, min, max, unit } = charts[sensorId];
    const centerX = 75;
    const centerY = 80;
    const radius = 60;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    ctx.clearRect(0, 0, 150, 80);

    // Draw background arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#ddd";
    ctx.stroke();

    // Convert value to range (min-max normalization)
    const normalizedValue = (value - min) / (max - min);
    let angle = startAngle + normalizedValue * (endAngle - startAngle);

    // Draw value arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, angle, false);
    ctx.lineWidth = 8;
    ctx.strokeStyle = color;
    ctx.stroke();

    document.getElementById(valueId).innerText = Math.round(value) + " " + unit;
}

// **🔹 Auto-Refresh Every 5 Seconds**
setInterval(fetchSensorData, 5000);

// **🔹 Fetch Data on Page Load**
fetchSensorData();



