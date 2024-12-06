async function onLoginSuccess() {
  $(".hide-after-login").hide();
  const me = await $.apiClient.getMe();
  $("#login-feedback").html(
    `<div class="alert alert-success">Ciao, <b>${me.username}</b><div id="total-net-worth"></div></div>`,
  );

  const accounts = await $.apiClient.listAccounts();
  accounts.forEach((account) => {
    $.accounts[account._id] = account;
  });


  await fetchNetCash();
  await fetchStockAssets();

  $(".show-after-login").show();
}

function updateTotalNetWorth() {
  let totalNet = 0;
  for (let k in $.accounts) {
    if ("total" in $.accounts[k]) totalNet += parseFloat($.accounts[k].total);
  }

  let totalStocks = 0;
  for (let key in $.stocks) {
    stock = $.stocks[key];
    current_value =
      "current_value" in stock ? parseFloat(stock.current_value) : 0;
    totalStocks += current_value;
  }

  totalNetWorth = totalNet + totalStocks;
  $("#total-net-worth").text(
    "Patrimonio attuale: " + totalNetWorth.toFixed(2) + " €",
  );
}

function updateAccountTable() {
  if (!$.accountsTable) return;
  $.accountsTable.clear();
  for (let key in $.accounts) {
    account = $.accounts[key];
    if ("total" in account) {
      $.accountsTable.row.add([
        account.name,
        account.total.toFixed(2) + " €",
        account.asset_type,
      ]);
    }
  }
  $.accountsTable.draw();
}

function updateStocksTable() {
  if (!$.stocksTable) return;
  $.stocksTable.clear();
  for (let key in $.stocks) {
    stock = $.stocks[key];
    current_value =
      "current_value" in stock ? parseFloat(stock.current_value) : null;
    price = "price" in stock ? parseFloat(stock.price) : null;
    current_yield = 0;
    if (current_value) {
      current_value = current_value.toFixed(2) + "  €";
      price = price.toFixed(2) + "  €";
      current_yield =
        ($.stocks[stock._id].current_value / stock.total_wfee - 1) * 100;
      direction = current_yield >= 0 ? "+" : "";
      current_yield = direction + current_yield.toFixed(2) + "%";
    }
    $.stocksTable.row.add([
      stock._id,
      stock.quantity,
      stock.total_wfee,
      price,
      current_value,
      current_yield,
    ]);
  }
  $.stocksTable.draw();
}

function refresh() {
  updateAccountTable();
  updateStocksTable();
  updateTotalNetWorth();
}

async function fetchNetCash() {
  today = new Date();
  today.setDate(today.getDate() + 1);
  const startOfTime = new Date(1900, 0, 2);
  startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  startOfMonth.setDate(startOfMonth.getDate() + 1);
  const todayFormatted = today.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  $("#tr-end").val(todayFormatted);

  // Get the start of the current month
  const startOfMonthFormatted = startOfMonth.toISOString().split("T")[0];

  const categories = await $.apiClient.aggregateTransactions(
    getStartOfTime(),
    getToday(),
    "category"   
  )

  categories.forEach((category) => {
    $.categories.push(category['_id'])
  })

  $("#tr-start").val(startOfMonthFormatted);
  const cashNet = await $.apiClient.aggregateTransactions(
    getStartOfTime(),
    getToday(),
    "account",
  );
  cashNet.forEach((accountNet) => {
    if (accountNet._id in $.accounts) {
      const account = $.accounts[accountNet._id];
      $.accounts[accountNet._id].total = accountNet.total;
    }
  });
  refresh();
}

async function fetchStockAssets() {
  const today = new Date();
  const formatted = today.toISOString().split("T")[0];
  const stockAssets = await $.apiClient.aggregateTransactions(
    formatted,
    formatted,
    "ticker",
  );
  stockAssets.forEach((stock) => {
    $.stocks[stock._id] = stock;
    stock_id = stock._id.replace(".", "");
    $.apiClient.getTickerPrice(stock._id).then((data) => {
      $.stocks[stock._id].price = data.price;
      $.stocks[stock._id].current_value =
        data.price * $.stocks[stock._id].quantity;

      refresh();
    });
  });
  refresh();
}

async function onTransactionFetched(transactions) {
  // Clear existing data in DataTable
  $.transactionsTable.clear();

  // Populate table
  transactions.forEach((transaction) => {
    $.transactions[transaction._id] = transaction;
    const account = $.accounts[transaction.account];
    const date = new Date(transaction.date);
    $.transactionsTable.row.add({
      id: transaction._id,
      amount: `${transaction.amount} €`,
      date: date.toISOString().split("T")[0],
      category: transaction.category,
      account: account.name,
      accountid: transaction.account,
      description: transaction.description || "N/A",
    });
  });

  // Redraw the table
  $.transactionsTable.draw();
}

async function boot() {
  $(".show-after-login").hide()
  const host = window.location.protocol + "//" + window.location.host;
  $.apiClient = new ApiClient(`${host}`);
  // APPLICATION DATA STATUS STORE
  $.accounts = {};
  $.stocks = {};
  $.transactions = {};
  $.categories = []
  // -----------------------------

  // Check for session token in storage and check for token validity
  if ($.apiClient.isLogged()) {
    try {
      const me = await $.apiClient.getMe();
      await onLoginSuccess();
    } catch (error) {
      $.apiClient.accessToken = null;
      window.localStorage.removeItem("token");
      const currentUrl = window.location.href;
      if(!currentUrl.endsWith(".html")) return;
      const newUrl = currentUrl.replace(/\/[^/]+\.html$/, "/");
      window.location.replace(newUrl);
    }
  } else {
    const currentUrl = window.location.href;
    if(!currentUrl.endsWith(".html")) return;
    const newUrl = currentUrl.replace(/new\.html$/, "");
    window.location.replace(newUrl);
  }
}

// Function to populate account dropdowns
function populateAccountDropdown(selectId) {
  const dropdown = $(`#${selectId}`);
  dropdown.empty(); // Clear existing options
  dropdown.append(
    '<option value="" disabled selected>Select an account</option>',
  ); // Default option
  for (v in $.accounts) {
    account = $.accounts[v];
    dropdown.append(`<option value="${v}">${account.name}</option>`);
  }
}

// Function to populate category dropdowns
function populateCategoryDropDowns(className) {
  let dropdown = $(`.${className}`)
  dropdown.empty(); // Clear existing options
  dropdown.append(
      '<option value="" disabled selected>Seleziona categoria</option>',
  ); // Default option
  $.categories.forEach( c =>  {
      dropdown.append(`<option value="${c}">${c}</option>`);
  });
}

function getToday() {
  today = new Date();
  today.setDate(today.getDate() + 1);
  return today.toISOString().split("T")[0];
}

function getStartOfTime() {
  const startOfTime = new Date(1900, 0, 2);
  return startOfTime.toISOString().split("T")[0];
}

async function onFilterClicked(start_date = null, end_date = null) {
  if (!start_date) start_date = getStartOfTime();
  if (!end_date) end_date = getToday();
  console.log(start_date, end_date);
  const transactions = await $.apiClient.listTransactions(start_date, end_date);
  onTransactionFetched(transactions);
}
