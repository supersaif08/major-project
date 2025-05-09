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
  { label: "xyz Sensor", unit: "Units", min: 0, max: 100 }
];

// Unique ON/OFF messages for each toggle (in order)
const toggleMessages = [
  ["hello", "bye"],
  ["open", "close"],
  ["start", "stop"],
  ["enable", "disable"],
  ["activate", "deactivate"],
  ["poweron", "poweroff"],
  ["run", "halt"],
  ["up", "down"]
];

// Setup MQTT client
const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt");

client.on("connect", function () {
  console.log("📡 Connected to MQTT broker");

  client.subscribe("Sensors_Data", function (err) {
    if (!err) console.log("✅ Subscribed to Sensors_Data");
  });

  client.subscribe("Relay_control", function (err) {
    if (!err) console.log("✅ Subscribed to Relay_control");
  });
});

// Create gauges and toggles
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
  createGauge(sensor, index);
});

function getColor(index) {
  const colors = ["#FF5733", "#FFA500", "#17A2B8", "#8E44AD", "#E67E22", "#27AE60", "#3498DB", "#FF6347"];
  return colors[index % colors.length];
}

function createGauge(sensor, index) {
  const container = document.createElement("div");
  container.classList.add("gauge-container");
  container.innerHTML = `  
    <div class="gauge-title">${sensor.label}</div>
    <div class="gauge-value" id="${sensor.id}-value">0 ${sensor.unit}</div>
  `;
  dashboard.appendChild(container);

  // Toggle setup
  const togglePanel = document.getElementById("toggle-panel");
  const toggleContainer = document.createElement("div");
  toggleContainer.classList.add("toggle-item");
  toggleContainer.innerHTML = `
    <label class="toggle-label">Relay ${index + 1}</label>
    <label class="switch">
      <input type="checkbox" id="${sensor.id}-toggle">
      <span class="slider round"></span>
    </label>
  `;
  togglePanel.appendChild(toggleContainer);

  // Attach toggle logic
  const toggle = document.getElementById(`${sensor.id}-toggle`);
  toggle.addEventListener("change", () => {
    const message = toggle.checked ? toggleMessages[index][0] : toggleMessages[index][1];
    const publishMessage = `relay${index + 1}=${message}`;
    client.publish("Relay_control", publishMessage);
    console.log(`🟢 Published: ${publishMessage}`);
  });

  charts[sensor.id] = {
    valueId: `${sensor.id}-value`,
    toggleId: `${sensor.id}-toggle`,
    unit: sensor.unit,
    currentValue: 0
  };
}

// Update sensor data
client.on("message", function (topic, message) {
  const msg = message.toString();

  if (topic === "Sensors_Data") {
    const data = msg.split(',');
    data.forEach(sensorMessage => {
      const match = sensorMessage.match(/([a-zA-Z\s]+):\s*(-?[\d\.]+)/);
      if (match) {
        const sensorName = match[1].trim().toLowerCase();
        const sensorValue = parseFloat(match[2]);
        const sensor = sensors.find(s => s.label.toLowerCase().includes(sensorName));
        if (sensor && !isNaN(sensorValue)) {
          charts[sensor.id].currentValue = sensorValue;
          const valueElement = document.getElementById(`${sensor.id}-value`);
          if (valueElement) {
            valueElement.innerText = `${Math.round(sensorValue)} ${sensor.unit}`;
          }
        }
      }
    });
    console.log("✅ Sensor values updated.");
  }

  if (topic === "Relay_control") {
    const lines = msg.split('\n');
    lines.forEach(line => {
      const match = line.trim().match(/^relay(\d)=(.+)$/i);
      if (match) {
        const relayNum = parseInt(match[1]);
        const action = match[2].toLowerCase();

        if (relayNum >= 1 && relayNum <= sensors.length) {
          const index = relayNum - 1;
          const [onMsg, offMsg] = toggleMessages[index];
          const sensorId = sensors[index].id;
          const toggleId = charts[sensorId].toggleId;
          const toggle = document.getElementById(toggleId);

          if (toggle) {
            if (action === onMsg.toLowerCase() && !toggle.checked) {
              toggle.checked = true;
              toggle.dispatchEvent(new Event("change"));
            } else if (action === offMsg.toLowerCase() && toggle.checked) {
              toggle.checked = false;
              toggle.dispatchEvent(new Event("change"));
            }
          }
        }
      }
    });
  }
});
