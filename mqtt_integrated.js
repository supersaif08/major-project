const dashboard = document.getElementById("dashboard");
const charts = {};
const sensors = [];

// Sensor definitions
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

// ON/OFF messages for each relay
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

const relayStates = Array(8).fill(false);  // false = OFF
const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt");

client.on("connect", function () {
  console.log("📡 Connected to MQTT broker");
  client.subscribe("Sensors_Data", err => !err && console.log("✅ Subscribed to Sensors_Data"));
  client.subscribe("Relay_control", err => !err && console.log("✅ Subscribed to Relay_control"));
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
    e.preventDefault(); // prevent toggle change
    const relayIndex = index;
    const nextState = !relayStates[relayIndex]; // what user wants
    const message = nextState ? toggleMessages[relayIndex][0] : toggleMessages[relayIndex][1];
    client.publish("Relay_control", `relay${relayIndex + 1}=${message}`);
    console.log(`🟡 Sent: relay${relayIndex + 1}=${message}`);
  });

  charts[sensor.id] = {
    valueId: `${sensor.id}-value`,
    toggleId: `${sensor.id}-toggle`,
    unit: sensor.unit,
    currentValue: 0
  };
}

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
          if (valueElement) valueElement.innerText = `${Math.round(sensorValue)} ${sensor.unit}`;
        }
      }
    });
    console.log("✅ Sensor values updated.");
  }

  if (topic === "Relay_control") {
    const lines = msg.split('\n');
    lines.forEach(line => {
      const match = line.trim().match(/^relay(\d+)=(Relay_\d+_C(ON|OFF))$/i);
      if (match) {
        const relayNum = parseInt(match[1]);
        const stateConfirmed = match[3].toUpperCase(); // ON or OFF
        if (relayNum >= 1 && relayNum <= sensors.length) {
          const index = relayNum - 1;
          const sensorId = sensors[index].id;
          const toggle = document.getElementById(charts[sensorId].toggleId);
          const isOn = stateConfirmed === "ON";

          relayStates[index] = isOn;
          toggle.checked = isOn;

          console.log(`✅ Relay ${relayNum} turned ${isOn ? 'ON' : 'OFF'} (confirmed by broker)`);
        }
      }
    });
  }
});