/*
  DIGIT ANALYSIS PRO
  Live Deriv tick analysis

  Public market-data connection.
  No account token is required for this analysis-only tool.
*/

let ws = null;

let digits = [];

let totalTicks = 0;

const MAX_STORAGE = 5000;

const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const symbolSelect = document.getElementById("symbol");

const windowSelect = document.getElementById("windowSize");

const statusEl = document.getElementById("status");

const connectBtn = document.getElementById("connectBtn");

const disconnectBtn = document.getElementById("disconnectBtn");


// -----------------------------------------------------
// CONNECT
// -----------------------------------------------------

function connect() {

  disconnect();

  const symbol = symbolSelect.value;

  statusEl.textContent = "CONNECTING...";
  statusEl.className = "status disconnected";

  /*
    Public Deriv WebSocket.
    The endpoint supports real-time public market data.
  */

  ws = new WebSocket(
    "wss://ws.binaryws.com/websockets/v3"
  );

  ws.onopen = function () {

    statusEl.textContent = "CONNECTED";
    statusEl.className = "status connected";

    connectBtn.disabled = true;
    disconnectBtn.disabled = false;

    /*
      Request historical ticks first.
    */

    ws.send(JSON.stringify({

      ticks_history: symbol,

      end: "latest",

      count: 100,

      style: "ticks",

      adjust_start_time: 1,

      subscribe: 0,

      req_id: 1

    }));


    /*
      Then subscribe to live ticks.
    */

    ws.send(JSON.stringify({

      ticks: symbol,

      subscribe: 1,

      req_id: 2

    }));

  };


  ws.onmessage = function (event) {

    try {

      const data = JSON.parse(event.data);

      handleMessage(data);

    } catch (error) {

      console.error(
        "Message parsing error:",
        error
      );

    }

  };


  ws.onerror = function () {

    statusEl.textContent = "CONNECTION ERROR";

    statusEl.className =
      "status disconnected";

  };


  ws.onclose = function () {

    statusEl.textContent = "DISCONNECTED";

    statusEl.className =
      "status disconnected";

    connectBtn.disabled = false;

    disconnectBtn.disabled = true;

  };

}


// -----------------------------------------------------
// MESSAGE HANDLER
// -----------------------------------------------------

function handleMessage(data) {

  /*
    Historical data
  */

  if (
    data.msg_type === "history" &&
    data.history &&
    Array.isArray(data.history.prices)
  ) {

    loadHistory(data.history.prices);

  }


  /*
    Live tick
  */

  if (
    data.msg_type === "tick" &&
    data.tick
  ) {

    processTick(data.tick);

  }


  /*
    API error
  */

  if (data.error) {

    console.error(
      "Deriv API error:",
      data.error
    );

  }

}


// -----------------------------------------------------
// LOAD HISTORY
// -----------------------------------------------------

function loadHistory(prices) {

  /*
    Clear existing data before loading history.
  */

  digits = [];

  counts.fill(0);

  totalTicks = 0;


  for (const price of prices) {

    const digit = extractLastDigit(
      price
    );

    if (digit === null) continue;

    addDigit(
      digit,
      false
    );

  }

  updateUI();

}


// -----------------------------------------------------
// PROCESS LIVE TICK
// -----------------------------------------------------

function processTick(tick) {

  const quote = Number(
    tick.quote
  );

  if (!Number.isFinite(quote)) {
    return;
  }


  const digit = extractLastDigit(
    quote
  );

  if (digit === null) {
    return;
  }


  /*
    Update live display.
  */

  document.getElementById(
    "currentPrice"
  ).textContent = formatPrice(
    quote
  );


  document.getElementById(
    "currentDigit"
  ).textContent = digit;


  const time = new Date(
    tick.epoch * 1000
  );


  document.getElementById(
    "tickTime"
  ).textContent =
    time.toLocaleTimeString();


  addDigit(
    digit,
    true
  );

  updateUI();

}


// -----------------------------------------------------
// EXTRACT LAST DIGIT
// -----------------------------------------------------

function extractLastDigit(price) {

  /*
    Convert price to string.

    The displayed decimal precision can vary by symbol.
    We take the final numeric digit from the quote string.
  */

  const stringPrice =
    String(price);


  const digitsOnly =
    stringPrice.replace(
      /\D/g,
      ""
    );


  if (!digitsOnly.length) {
    return null;
  }


  return Number(
    digitsOnly[
      digitsOnly.length - 1
    ]
  );

}


// -----------------------------------------------------
// ADD DIGIT
// -----------------------------------------------------

function addDigit(
  digit,
  countAsTick = true
) {

  digits.push(digit);

  counts[digit]++;

  if (countAsTick) {
    totalTicks++;
  }


  /*
    Keep memory under control.
  */

  if (digits.length > MAX_STORAGE) {

    const removed =
      digits.shift();

    counts[removed]--;

  }

}


// -----------------------------------------------------
// UPDATE EVERYTHING
// -----------------------------------------------------

function updateUI() {

  const windowSize =
    Number(
      windowSelect.value
    );


  const recent =
    digits.slice(
      -windowSize
    );


  if (!recent.length) {

    document.getElementById(
      "analysisSummary"
    ).textContent =
      "Waiting for data...";

    return;

  }


  const recentCounts =
    [0,0,0,0,0,0,0,0,0,0];


  for (const digit of recent) {

    recentCounts[digit]++;

  }


  /*
    Determine most / least frequent
  */

  let mostDigit = 0;

  let leastDigit = 0;


  for (
    let i = 1;
    i < 10;
    i++
  ) {

    if (
      recentCounts[i] >
      recentCounts[mostDigit]
    ) {

      mostDigit = i;

    }


    if (
      recentCounts[i] <
      recentCounts[leastDigit]
    ) {

      leastDigit = i;

    }

  }


  const mostPercent =
    (
      recentCounts[mostDigit] /
      recent.length *
      100
    ).toFixed(1);


  const leastPercent =
    (
      recentCounts[leastDigit] /
      recent.length *
      100
    ).toFixed(1);


  document.getElementById(
    "analysisSummary"
  ).innerHTML =
    `Window: <b>${recent.length}</b> ticks |
     Most frequent: <b>${mostDigit}</b>
     (${mostPercent}%) |
     Least frequent: <b>${leastDigit}</b>
     (${leastPercent}%)`;


  updateTable(
    recent,
    recentCounts
  );


  updateBars(
    recent,
    recentCounts
  );


  updateRecentDigits();


  document.getElementById(
    "totalTicks"
  ).textContent =
    totalTicks;


  const unique =
    recentCounts.filter(
      x => x > 0
    ).length;


  document.getElementById(
    "uniqueDigits"
  ).textContent =
    unique;


  document.getElementById(
    "mostFrequent"
  ).textContent =
    mostDigit;


  document.getElementById(
    "leastFrequent"
  ).textContent =
    leastDigit;

}


// -----------------------------------------------------
// TABLE
// -----------------------------------------------------

function updateTable(
  recent,
  recentCounts
) {

  const table =
    document.getElementById(
      "digitTable"
    );


  table.innerHTML = "";


  for (
    let digit = 0;
    digit <= 9;
    digit++
  ) {

    const count =
      recentCounts[digit];


    const percent =
      recent.length ?
      (
        count /
        recent.length *
        100
      ).toFixed(1) :
      "0.0";


    const tr =
      document.createElement(
        "tr"
      );


    tr.innerHTML = `

      <td>
        <strong>${digit}</strong>
      </td>

      <td>
        ${count}
      </td>

      <td>
        ${percent}%
      </td>

      <td>
        ${count > 0 ? "ACTIVE" : "-"}
      </td>

      <td>

        <div class="mini-bar">

          <div
            class="mini-fill"
            style="width:${Math.min(
              percent,
              100
            )}%"
          ></div>

        </div>

      </td>

    `;


    table.appendChild(
      tr
    );

  }

}


// -----------------------------------------------------
// BARS
// -----------------------------------------------------

function updateBars(
  recent,
  recentCounts
) {

  for (
    let digit = 0;
    digit <= 9;
    digit++
  ) {

    const percent =
      recent.length ?
      (
        recentCounts[digit] /
        recent.length *
        100
      ) :
      0;


    const bar =
      document.getElementById(
        "bar" + digit
      );


    const text =
      document.getElementById(
        "percent" + digit
      );


    bar.style.width =
      percent + "%";


    text.textContent =
      percent.toFixed(1) + "%";

  }

}


// -----------------------------------------------------
// RECENT DIGITS
// -----------------------------------------------------

function updateRecentDigits() {

  const container =
    document.getElementById(
      "recentDigits"
    );


  const recent =
    digits.slice(
      -40
    ).reverse();


  if (!recent.length) {

    container.textContent =
      "No data yet";

    return;

  }


  container.innerHTML = "";


  recent.forEach(
    (
      digit,
      index
    ) => {

      const div =
        document.createElement(
          "div"
        );


      div.className =
        "digit-box";


      if (index === 0) {

        div.classList.add(
          "latest"
        );

      }


      div.textContent =
        digit;


      container.appendChild(
        div
      );

    }
  );

}


// -----------------------------------------------------
// FORMAT PRICE
// -----------------------------------------------------

function formatPrice(price) {

  return Number(
    price
  ).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 8
    }
  );

}


// -----------------------------------------------------
// CLEAR DATA
// -----------------------------------------------------

function clearData() {

  digits = [];

  counts.fill(0);

  totalTicks = 0;

  document.getElementById(
    "currentDigit"
  ).textContent = "-";

  document.getElementById(
    "currentPrice"
  ).textContent =
    "Waiting for tick...";

  document.getElementById(
    "tickTime"
  ).textContent =
    "--";


  updateUI();

}


// -----------------------------------------------------
// DISCONNECT
// -----------------------------------------------------

function disconnect() {

  if (ws) {

    try {

      ws.close();

    } catch (error) {

      console.error(error);

    }

  }

  ws = null;

  statusEl.textContent =
    "DISCONNECTED";

  statusEl.className =
    "status disconnected";

  connectBtn.disabled =
    false;

  disconnectBtn.disabled =
    true;

}


// -----------------------------------------------------
// WINDOW CHANGE
// -----------------------------------------------------

windowSelect.addEventListener(
  "change",
  updateUI
);


// -----------------------------------------------------
// SYMBOL CHANGE
// -----------------------------------------------------

symbolSelect.addEventListener(
  "change",
  function () {

    if (
      ws &&
      ws.readyState ===
      WebSocket.OPEN
    ) {

      connect();

    }

  }
);


// -----------------------------------------------------
// INITIAL UI
// -----------------------------------------------------

updateUI();
