const dashboard = document.getElementById("dashboard");
const charts = {};
const sensors = [];

const toggleMessages = [
  ["Relay_1_TON", "Relay_1_TOFF"],
  ["Relay_2_TON", "Relay_2_TOFF"],
  ["Relay_3_TON", "Relay_3_TOFF"],
  ["Relay_4_TON", "Relay_4_TOFF"],
  ["Relay_5_TON", "Relay_5_TOFF"],
  ["Relay_6_TON", "Relay_6_TOFF"],
  ["Relay_7_TON", "Relay_7_TOFF"],
  ["Relay_8_TON", "Relay_8_TOFF"]
];

const sensorDefinitions = [
  { label: "Current Sensor", unit: "A", min: 0, max: 30 },
  { label: "Temperature Sensor", unit: "°C", min: 10, max: 100 },
  { label: "Humidity Sensor", unit: "%", min: 20, max: 90 },
  { label: "Vibration Sensor", unit: "m/s²", min: 0, max: 5 },
  { label: "Pressure Sensor", unit: "Pa", min: 950, max: 1050 },
  { label: "RPM Sensor", unit: "RPM", min: 0, max: 5000 },
  { label: "Water Flow Sensor", unit: "L/min", min: 0, max: 100 },
  { label: "Light Intensity Sensor", unit: "Units", min: 0, max: 100 }
];

const relayStates = Array(8).fill(false);
const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt");

client.on("connect", function () {
  console.log("📡 Connected to MQTT broker");
  client.subscribe("sensor_relay", err => !err && console.log("✅ Subscribed to sensor_relay"));
});

sensorDefinitions.forEach((sensorDef, index) => {
  const isPressure = sensorDef.label === "Pressure Sensor";

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

  if (!isPressure) {
    createGauge(sensor, index);
  }

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

  const toggle = document.getElementById(`${sensor.id}-toggle`);
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const relayIndex = index;
    const nextState = !relayStates[relayIndex];
    const message = (nextState ? toggleMessages[relayIndex][0] : toggleMessages[relayIndex][1]).toUpperCase();
    client.publish("sensor_relay", message);
    console.log(`🟡 Sent: relay${relayIndex + 1}=${message}`);
  });

  charts[sensor.id] = {
    valueId: isPressure ? null : `${sensor.id}-value`,
    toggleId: `${sensor.id}-toggle`,
    unit: sensor.unit,
    currentValue: 0
  };
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
}

client.on("message", function (topic, message) {
  const msg = message.toString();

  if (topic === "sensor_relay") {
    const data = msg.split(',');

    data.forEach(item => {
      const trimmed = item.trim();

      // Match sensor values like: CURRENT_SENSOR_12.5
      const sensorMatch = trimmed.match(/^([A-Z_]+)_(-?[\d\.]+)$/);

      // Match relay commands like: RELAY_2_CON or RELAY_4_COFF
      const relayMatch = trimmed.match(/^RELAY_(\d+)_C(ON|OFF)$/);

      if (sensorMatch) {
        const sensorKey = sensorMatch[1];
        const sensorValue = parseFloat(sensorMatch[2]);

        const sensor = sensors.find(s => s.label.replace(/\s+/g, "_").toUpperCase() === sensorKey);
        if (sensor && !isNaN(sensorValue)) {
          charts[sensor.id].currentValue = sensorValue;

          if (charts[sensor.id].valueId) {
            const valueElement = document.getElementById(charts[sensor.id].valueId);
            if (valueElement) valueElement.innerText = `${Math.round(sensorValue)} ${sensor.unit}`;
          }
        }
      }

      if (relayMatch) {
        const relayNum = parseInt(relayMatch[1]);
        const stateConfirmed = relayMatch[2].toUpperCase();

        if (relayNum >= 1 && relayNum <= sensors.length) {
          const index = relayNum - 1;
          const sensorId = sensors[index].id;
          const toggle = document.getElementById(charts[sensorId].toggleId);
          const isOn = stateConfirmed === "ON";

          relayStates[index] = isOn;
          if (toggle) toggle.checked = isOn;

          console.log(`✅ Relay ${relayNum} turned ${isOn ? 'ON' : 'OFF'} (confirmed by broker)`);
        }
      }
    });

    console.log("✅ Multiple sensor and relay states updated.");
  }
});
