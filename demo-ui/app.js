const pricing = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

const state = {
  history: [],
  turns: 0,
  totalTokens: 0,
  totalCost: 0,
  isStreaming: false,
};

const form = document.querySelector("#chatForm");
const personaInput = document.querySelector("#persona");
const promptInput = document.querySelector("#prompt");
const chatFeed = document.querySelector("#chatFeed");
const messageStack = document.querySelector("#messageStack");
const comparisonRows = document.querySelector("#comparisonRows");
const compareButton = document.querySelector("#compareButton");
const resetButton = document.querySelector("#resetButton");
const runtimeStatus = document.querySelector("#runtimeStatus");
const statusDot = document.querySelector(".status-dot");
const sliders = [
  ["temperature", "temperatureValue"],
  ["topP", "topPValue"],
  ["maxTokens", "maxTokensValue"],
];

sliders.forEach(([inputId, outputId]) => {
  const input = document.querySelector(`#${inputId}`);
  const output = document.querySelector(`#${outputId}`);
  input.addEventListener("input", () => {
    output.textContent = input.value;
  });
});

function estimateTokens(text) {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function estimateCost(prompt, response, model = "gpt-4o") {
  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(response);
  const modelPricing = pricing[model] || pricing["gpt-4o"];
  return {
    inputTokens,
    outputTokens,
    totalCost:
      (inputTokens / 1000) * modelPricing.input +
      (outputTokens / 1000) * modelPricing.output,
  };
}

function buildReply(prompt, persona) {
  const tone = persona.toLowerCase().includes("ngắn") ? "ngắn gọn" : "rõ ràng";
  const creativity = Number(document.querySelector("#temperature").value);
  const style =
    creativity > 1.1
      ? "mở rộng bằng ví dụ sáng tạo"
      : "giữ cấu trúc chắc và dễ kiểm chứng";

  return `Mình sẽ trả lời ${tone}: "${prompt}" được gửi kèm system prompt, history gần nhất và tham số sampling. Với demo này, phản hồi được tách thành nhiều chunk để bạn thấy streaming xuất hiện dần, sau đó history chỉ giữ 3 lượt cuối. Cách triển khai nên ${style}.`;
}

function renderRuntimeStatus(label, mode = "mock") {
  runtimeStatus.textContent = label;
  statusDot.dataset.mode = mode;
}

async function loadRuntimeConfig() {
  if (window.location.protocol === "file:") {
    renderRuntimeStatus("File mock mode", "mock");
    return;
  }

  try {
    const response = await fetch("/api/config");
    const payload = await response.json();
    renderRuntimeStatus(
      payload.hasKey ? `Real API ready: ${payload.model}` : "Server mock mode",
      payload.hasKey ? "api" : "mock",
    );
  } catch {
    renderRuntimeStatus("Browser mock mode", "mock");
  }
}

async function requestReplyStream(prompt, persona, target) {
  if (window.location.protocol === "file:") {
    const reply = buildReply(prompt, persona);
    await streamText(target, reply);
    return {
      reply,
      source: "mock-file",
      ...estimateCost(prompt, reply),
    };
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona,
        prompt,
        history: state.history,
        temperature: Number(document.querySelector("#temperature").value),
        topP: Number(document.querySelector("#topP").value),
        maxTokens: Number(document.querySelector("#maxTokens").value),
      }),
    });

    if (!response.ok) throw new Error("Request failed");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    let stats = null;
    state.isStreaming = true;
    form.querySelector(".primary-button").disabled = true;
    target.textContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop();

      for (const event of events) {
        const line = event.split("\n").find((part) => part.startsWith("data: "));
        if (!line) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.type === "delta") {
          reply += payload.text;
          target.textContent = reply;
          chatFeed.scrollTop = chatFeed.scrollHeight;
        }
        if (payload.type === "done") {
          stats = payload;
        }
      }
    }

    form.querySelector(".primary-button").disabled = false;
    state.isStreaming = false;

    if (!stats) throw new Error("Missing stream stats");
    renderRuntimeStatus(stats.source === "api" ? "Real API streaming" : "Mock fallback", stats.source === "api" ? "api" : "mock");
    return {
      reply,
      source: stats.source,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      totalCost: stats.totalCost,
    };
  } catch {
    const reply = buildReply(prompt, persona);
    await streamText(target, reply);
    const result = {
      reply,
      source: "mock-browser",
      ...estimateCost(prompt, reply),
    };
    renderRuntimeStatus("Browser mock fallback", "mock");
    return result;
  }
}

function addMessage(role, content) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const label = role === "assistant" ? "Assistant" : role === "system" ? "System" : "User";
  message.innerHTML = `<strong>${label}</strong><span></span>`;
  message.querySelector("span").textContent = content;
  chatFeed.appendChild(message);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return message.querySelector("span");
}

function renderStack(persona, nextPrompt = "") {
  const messages = [
    { role: "system", content: persona },
    ...state.history,
  ];

  if (nextPrompt) {
    messages.push({ role: "user", content: nextPrompt });
  }

  messageStack.innerHTML = "";
  messages.slice(-7).forEach((message) => {
    const item = document.createElement("li");
    item.innerHTML = `<b>${message.role}</b><span></span>`;
    item.querySelector("span").textContent = message.content;
    messageStack.appendChild(item);
  });
}

function renderStats() {
  document.querySelector("#turnCount").textContent = state.turns;
  document.querySelector("#totalTokens").textContent = state.totalTokens;
  document.querySelector("#totalCost").textContent = `$${state.totalCost.toFixed(6)}`;
  document.querySelector("#historyKept").textContent = `${state.history.length} / 6`;
}

async function streamText(target, text) {
  state.isStreaming = true;
  form.querySelector(".primary-button").disabled = true;
  target.textContent = "";
  const words = text.split(" ");

  for (let index = 0; index < words.length; index += 1) {
    target.textContent += `${index === 0 ? "" : " "}${words[index]}`;
    chatFeed.scrollTop = chatFeed.scrollHeight;
    await new Promise((resolve) => setTimeout(resolve, 34));
  }

  form.querySelector(".primary-button").disabled = false;
  state.isStreaming = false;
}

async function handleSend(event) {
  event.preventDefault();
  if (state.isStreaming) return;

  const persona = personaInput.value.trim();
  const prompt = promptInput.value.trim();
  if (!prompt) {
    promptInput.focus();
    return;
  }

  if (state.turns === 0) {
    addMessage("system", persona);
  }
  addMessage("user", prompt);
  renderStack(persona, prompt);

  const target = addMessage("assistant", "");
  const result = await requestReplyStream(prompt, persona, target);
  const reply = result.reply;

  state.history.push({ role: "user", content: prompt });
  state.history.push({ role: "assistant", content: reply });
  state.history = state.history.slice(-6);
  state.turns += 1;

  state.totalTokens += result.inputTokens + result.outputTokens;
  state.totalCost += result.totalCost;
  renderStats();
  renderStack(persona);
}

function renderComparison() {
  const prompt = promptInput.value.trim() || "Giải thích token là gì.";
  const gpt4oResponse = "Phản hồi đầy đủ hơn, diễn giải kỹ các khái niệm và liên hệ tới sản phẩm thật.";
  const miniResponse = "Phản hồi ngắn hơn, nhanh hơn, phù hợp demo hoặc tác vụ đơn giản.";
  const rows = [
    {
      model: "gpt-4o",
      latency: `${(1.35 + prompt.length / 260).toFixed(2)}s`,
      cost: estimateCost(prompt, gpt4oResponse, "gpt-4o").totalCost,
      response: gpt4oResponse,
    },
    {
      model: "gpt-4o-mini",
      latency: `${(0.48 + prompt.length / 520).toFixed(2)}s`,
      cost: estimateCost(prompt, miniResponse, "gpt-4o-mini").totalCost,
      response: miniResponse,
    },
  ];

  comparisonRows.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "comparison-row";
    item.setAttribute("role", "row");
    item.innerHTML = `
      <span role="cell">${row.model}</span>
      <span role="cell">${row.latency}</span>
      <span role="cell">$${row.cost.toFixed(6)}</span>
      <span role="cell"></span>
    `;
    item.querySelector("span:last-child").textContent = row.response;
    comparisonRows.appendChild(item);
  });
}

async function compareModels() {
  const prompt = promptInput.value.trim() || "Giải thích token là gì.";
  if (window.location.protocol === "file:") {
    renderComparison();
    return;
  }

  compareButton.disabled = true;
  try {
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        temperature: Number(document.querySelector("#temperature").value),
        topP: Number(document.querySelector("#topP").value),
        maxTokens: Number(document.querySelector("#maxTokens").value),
      }),
    });
    if (!response.ok) throw new Error("Compare failed");
    const payload = await response.json();
    comparisonRows.innerHTML = "";
    payload.rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "comparison-row";
      item.setAttribute("role", "row");
      item.innerHTML = `
        <span role="cell">${row.model}</span>
        <span role="cell">${row.latency.toFixed(2)}s</span>
        <span role="cell">$${row.cost.toFixed(6)}</span>
        <span role="cell"></span>
      `;
      item.querySelector("span:last-child").textContent = row.response;
      comparisonRows.appendChild(item);
    });
    renderRuntimeStatus(payload.source === "api" ? "Real compare complete" : "Mock compare fallback", payload.source === "api" ? "api" : "mock");
  } catch {
    renderComparison();
    renderRuntimeStatus("Compare mock fallback", "mock");
  } finally {
    compareButton.disabled = false;
  }
}

function resetDemo() {
  state.history = [];
  state.turns = 0;
  state.totalTokens = 0;
  state.totalCost = 0;
  state.isStreaming = false;
  chatFeed.innerHTML = "";
  renderStats();
  renderStack(personaInput.value.trim());
  renderComparison();
}

function drawSignal() {
  const canvas = document.querySelector("#signalCanvas");
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  context.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const nodes = [
    [width * 0.13, height * 0.46],
    [width * 0.38, height * 0.28],
    [width * 0.63, height * 0.54],
    [width * 0.86, height * 0.34],
  ];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const time = reducedMotion ? 0 : performance.now() / 1000;

  context.clearRect(0, 0, width, height);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(181, 224, 213, 0.35)";
  context.beginPath();
  nodes.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  nodes.forEach(([x, y], index) => {
    context.beginPath();
    context.fillStyle = ["#75d5cf", "#e3b36c", "#8fd58d", "#f08da0"][index];
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.strokeStyle = "rgba(255,255,255,0.2)";
    context.arc(x, y, 22 + Math.sin(time * 2 + index) * 3, 0, Math.PI * 2);
    context.stroke();
  });

  for (let index = 0; index < 16; index += 1) {
    const progress = (time * 0.18 + index / 16) % 1;
    const x = width * (0.1 + progress * 0.8);
    const y = height * (0.47 + Math.sin(progress * Math.PI * 3 + time) * 0.18);
    context.fillStyle = index % 2 === 0 ? "rgba(117, 213, 207, 0.9)" : "rgba(227, 179, 108, 0.85)";
    context.fillRect(x, y, 18, 6);
  }

  if (!reducedMotion) {
    requestAnimationFrame(drawSignal);
  }
}

form.addEventListener("submit", handleSend);
compareButton.addEventListener("click", compareModels);
resetButton.addEventListener("click", resetDemo);
personaInput.addEventListener("input", () => renderStack(personaInput.value.trim()));
promptInput.addEventListener("input", renderComparison);

renderStats();
renderStack(personaInput.value.trim());
renderComparison();
loadRuntimeConfig();
drawSignal();
