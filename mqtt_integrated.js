const dashboard = document.getElementById("dashboard");
const charts = {};
const sensors = [];

const sensorDefinitions = [
  { label: "Current Sensor", unit: "A", min: 0, max: 30 },
  { label: "Temperature Sensor", unit: "°C", min: 10, max: 100 },
  { label: "Humidity Sensor", unit: "%", min: 20, max: 90 },
  { label: "Vibration Sensor", unit: "m/s²", min: 0, max: 5 },
  { label: "Pressure Sensor", unit: "Pa", min: 950, max: 1050 },
  { label: "RPM Sensor", unit: "RPM", min: 0, max: 5000 },
  { label: "Water Flow Sensor", unit: "L/min", min: 0, max: 100 },
  { label: "xyz Sensor", unit: "Units", min: 0, max: 100 } // New sensor added here
];

// Function to get the color for each sensor based on its index
function getColor(index) {
  const colors = ["#FF5733", "#FFA500", "#17A2B8", "#8E44AD", "#E67E22", "#27AE60", "#3498DB", "#FF6347"];
  return colors[index % colors.length];
}

// Create gauges for each sensor
sensorDefinitions.forEach((sensorDef, index) => {
  const sensorId = sensorDef.label.replace(/\s+/g, "").toLowerCase();
  const sensor = {
    id: sensorId,
    label: sensorDef.label,
    unit: sensorDef.unit,
    min: sensorDef.min,
    max: sensorDef.max,
    color: getColor(index)
  };
  sensors.push(sensor);
  createGauge(sensor);
});

// Create a gauge and its corresponding toggle
function createGauge(sensor) {
  const container = document.createElement("div");
  container.classList.add("gauge-container");
  container.innerHTML = `
    <div class="gauge-title">${sensor.label}</div>
    <div class="gauge-value" id="${sensor.id}-value">0 ${sensor.unit}</div>
  `;
  dashboard.appendChild(container);

  // Add toggle panel
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

  // Store the sensor data for later use
  charts[sensor.id] = {
    valueId: `${sensor.id}-value`,
    unit: sensor.unit,
    currentValue: 0
  };
}

// MQTT Setup
const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt");

client.on("connect", function () {
  console.log("📡 Connected to MQTT broker");
  client.subscribe("topic12", function (err) {
    if (!err) {
      console.log("✅ Subscribed to topic12");
    } else {
      console.error("❌ Failed to subscribe:", err);
    }
  });
});

client.on("message", function (topic, message) {
  if (topic === "topic12") {
    // Split the incoming message by commas
    const data = message.toString().split(',');

    // Iterate over each sensor message
    data.forEach(sensorMessage => {
      // Extract sensor name and value from the message
      const match = sensorMessage.match(/([a-zA-Z\s]+):\s*(-?[\d\.]+)/);
      if (match) {
        const sensorName = match[1].trim().toLowerCase();
        const sensorValue = parseFloat(match[2]);

        // Find the corresponding sensor by its name
        const sensor = sensors.find(s => s.label.toLowerCase().includes(sensorName));

        if (sensor && !isNaN(sensorValue)) {
          // Update the sensor value in the chart object
          charts[sensor.id].currentValue = sensorValue;
          const valueElement = document.getElementById(`${sensor.id}-value`);
          if (valueElement) {
            valueElement.innerText = `${Math.round(sensorValue)} ${sensor.unit}`;
          }
        } else {
          console.warn(`⚠️ Invalid sensor data or no matching sensor found for: ${sensorName}`);
        }
      }
    });

    console.log("✅ MQTT sensor values updated:", data);
  }
});