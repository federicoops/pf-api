class AppState {
  constructor() {
    this.accounts = {};
    this.stocks = {};
    this.transactions = {};
    this.categories = [];
    this.accountsTable = null;
    this.stocksTable = null;
    this.transactionsTable = null;
    this.apiClient = null;
  }
}

const appState = new AppState();

const Utils = {
  formatCurrency: (value) => `${value.toFixed(2)} €`,
  formatYield: (value) => {
    let direction = (value>=0)? "+":"";
    return `${direction}${value.toFixed(2)} %`
  },
  formatDate: (date) => new Date(date).toISOString().split("T")[0],
  getToday: () => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Increment day by 1
    return today.toISOString().split("T")[0];
  },
  getStartOfTime: () => new Date(1900, 0, 2).toISOString().split("T")[0],
};

class AccountManager {
  static async refreshAccounts() {
    try {
      const accounts = await appState.apiClient.listAccounts();
      appState.accounts = accounts.reduce((acc, account) => {
        acc[account._id] = account;
        return acc;
      }, {});

      await NetManager.fetchNetCash();
      await StockManager.fetchStockAssets();
    } catch (error) {
      console.error("Error refreshing accounts:", error);
    }
  }

  static updateAccountTable() {
    if (!appState.accountsTable) return;

    appState.accountsTable.clear();
    let total = 0;

    Object.values(appState.accounts).forEach((account) => {
      if (account.total) {
        total += account.total;
        appState.accountsTable.row.add([
          account.name,
          Utils.formatCurrency(account.total),
          account.asset_type,
        ]);
      }
    });

    $("#totalCash").text(Utils.formatCurrency(total));
    appState.accountsTable.draw();
  }
}

class StockManager {
  static async fetchStockAssets() {
    try {
      const today = Utils.getToday();
      const stockAssets = await appState.apiClient.aggregateTransactions(
        today,
        today,
        "ticker"
      );

      stockAssets.forEach((stock) => {
        appState.stocks[stock._id] = stock;

        appState.apiClient.getTickerPrice(stock._id).then((data) => {
          const stockData = appState.stocks[stock._id];
          stockData.price = data.price;
          stockData.current_value = data.price * stockData.quantity;
          stockData.daily_yield = data.daily_yield
          UIManager.refresh();
        });
      });

      UIManager.refresh();
    } catch (error) {
      console.error("Error fetching stock assets:", error);
    }
  }

  static updateStocksTable() {
    if (!appState.stocksTable) return;

    appState.stocksTable.clear();
    let total = 0;
    let totalInvested = 0;
    Object.values(appState.stocks).forEach((stock) => {
      const current_value = stock.current_value
        ? Utils.formatCurrency(stock.current_value)
        : null;
      const price = stock.price ? `${Utils.formatCurrency(stock.price)} (${Utils.formatYield(stock.daily_yield)})` : null;
      const current_yield = stock.current_value
        ? `+${((stock.current_value / stock.total_wfee - 1) * 100).toFixed(2)}%`
        : "N/A";
      total += stock.current_value || 0;
      totalInvested += stock.total_wfee;
      appState.stocksTable.row.add([
        stock._id,
        stock.quantity,
        stock.total_wfee,
        price,
        current_value,
        current_yield,
      ]);
    });

    $("#currentTotal").text(Utils.formatCurrency(total));
    $("#totalInv").text(`(+${(100*(total/totalInvested-1)).toFixed(2)}%)`);
    appState.stocksTable.draw();
  }

  static updateStocksTableWeighted() {
    if(!appState.weightedStocksTable) return;
    appState.weightedStocksTable.clear();
    let total = 0;
    let totalInvested = 0;

    Object.values(appState.stocks).forEach((stock) => {
      total += stock.current_value || 0;
      totalInvested += stock.total_wfee;
    });

    Object.values(appState.stocks).forEach((stock) => {
      const current_value = stock.current_value
        ? Utils.formatCurrency(stock.current_value)
        : null;
      const current_weight = stock.current_value
        ? `${((stock.current_value / total) * 100).toFixed(2)}%`
        : "N/A";

      appState.weightedStocksTable.row.add([
        stock._id,
        stock.quantity,
        current_value,
        current_weight,
      ]);
    });

    $("#currentTotal").text(Utils.formatCurrency(total));
    $("#totalInv").text(`(+${(100*(total/totalInvested-1)).toFixed(2)}%)`);
    appState.weightedStocksTable.draw();
  }
}

class NetManager {
  static async fetchNetCash() {
    try {
      const cashNet = await appState.apiClient.aggregateTransactions(
        Utils.getStartOfTime(),
        Utils.getToday(),
        "account"
      );

      const categories = await appState.apiClient.aggregateTransactions(
        Utils.getStartOfTime(),
        Utils.getToday(),
        "category"
      )
    
      categories.forEach((category) => {
        appState.categories[category['_id']] = {name:category['_id']}
      })

      cashNet.forEach((accountNet) => {
        if (appState.accounts[accountNet._id]) {
          appState.accounts[accountNet._id].total = accountNet.total;
        }
      });

      UIManager.refresh();
    } catch (error) {
      console.error("Error fetching net cash:", error);
    }
  }

  static async updateTotalNetWorth() {
    const totalNet = Object.values(appState.accounts).reduce(
      (sum, acc) => sum + (acc.total || 0),
      0
    );

    const totalStocks = Object.values(appState.stocks).reduce(
      (sum, stock) => sum + (stock.current_value || 0),
      0
    );

    const totalNetWorth = totalNet + totalStocks;

    $("#total-net-worth").text(
      `Patrimonio attuale: ${Utils.formatCurrency(totalNetWorth)}`
    );
  }
}

class UIManager {

  static menuItems = [
    { href: "./", label: "Home" },
    { href: "./new.html", label: "Nuovo movimento" },
    { href: "./transactions.html", label: "Tutti i movimenti" },
    { href: "./expenses.html", label: "Dettaglio spese" },
    { href: "./accounts.html", label: "Conti" },
    { href: "./year.html", label: "Vista anno" },
    { href: "./inv.html", label: "Investimenti" },
  ];

  static refresh() {
    AccountManager.updateAccountTable();
    StockManager.updateStocksTable();
    NetManager.updateTotalNetWorth();
    StockManager.updateStocksTableWeighted()
  }

  static populateDropdown(selector, items, defaultOption) {
    const dropdown = $(selector);
    dropdown.empty();
    dropdown.append(`<option value="" disabled selected>${defaultOption}</option>`);
    for(let item in items) {
      dropdown.append(`<option value="${item}">${items[item].name}</option>`);
    }
  }

  static generateMenu() {
    const currentPage = window.location.pathname.split("/").pop();
    console.log(this.menuItems)
    this.menuItems.forEach(item => {
      const menuItem = $(`<a href="${item.href}" class="btn btn-light show-after-login">${item.label}</a>`);
      if (item.href.split("/").pop() === currentPage) {
          menuItem.removeClass('btn-light').addClass('btn-primary');
      }
      $("#menu").append(menuItem);
    });
  }
}

async function onLoginSuccess() {
  try {

    const user = await appState.apiClient.getMe();
    $(".hide-after-login").hide();

    $("#login-feedback").html(
      `<div class="alert alert-success">Ciao, <b>${user.username}</b><div id="total-net-worth"></div></div>`
    );

    await AccountManager.refreshAccounts();

    $(".show-after-login").show();
  } catch (error) {
    console.error("Error during login success process:", error);
    $("#login-feedback").html(
      `<div class="alert alert-danger">Login failed. Please try again.</div>`
    );
    redirectToLogin();
  }
}

function redirectToLogin() {
  const currentUrl = window.location.href;
  if(!currentUrl.endsWith(".html")) return;
  const newUrl = currentUrl.replace(/\/[^/]+\.html$/, "/");
  window.location.replace(newUrl);
}

function getBaseUrl() {
  const currentUrl = window.location.href;
  const appIndex = currentUrl.indexOf('/app/');

  // If "/app/" exists in the URL, strip everything after it
  if (appIndex !== -1) {
      return currentUrl.substring(0, appIndex); // Include the trailing slash
  }

  // Fallback: return the root if "/app/" is not found
  return '/';
}

async function boot() {
  $(".show-after-login").hide()
  const host = getBaseUrl();
  appState.apiClient = new ApiClient(`${host}`);
  if (appState.apiClient.isLogged()) {
    try {
      const me = await appState.apiClient.getMe();
      await onLoginSuccess();
      UIManager.generateMenu()
    } catch (error) {
      appState.apiClient.accessToken = null;
      window.localStorage.removeItem("token");
      redirectToLogin()
    }
  } else {
    redirectToLogin()
  }
}
