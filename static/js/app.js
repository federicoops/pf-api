class AppState {
  constructor() {
    this.accounts = {};
    this.stocks = {};
    this.brokers = {};
    this.transactions = {};
    this.categories = [];
    this.accountsTable = null;
    this.stocksTable = null;
    this.transactionsTable = null;
    this.apiClient = null;
    this.accountLogos = {
      FindomesticCC: "./img/account-logos/findomestic.png",
      FindomesticCD: "./img/account-logos/findomestic.png",
      Revolut: "./img/account-logos/revolut.jpg",
      Moneyfarm: "./img/account-logos/moneyfarm.jpeg",
      Paypal: "./img/account-logos/paypal.webp",
      Directa: "./img/account-logos/directa.png",
      Isybank: "./img/account-logos/isybank.jpg",
      CAAutoBank: "./img/account-logos/caautobank.png",
      CartaYOU: "./img/account-logos/advanzia.jpeg",
      Wise: "./img/account-logos/wise.png",
    };
    this.accountTypesFormat = {
      liq: { name: "Liquidità" },
      deps: { name: "Deposito svincolabile" },
      depl: { name: "Deposito libero" },
      deb: { name: "Debiti" },
      debc: { name: "Carta di credito" },
      inv: { name: "Investimenti" },
      cred: { name: "Crediti" },
    };
  }
}

const appState = new AppState();

const Utils = {
  formatCurrency: (value) => `${value.toFixed(2)}<i class="bi bi-currency-euro"></i>`,
  formatYield: (value) => {
    let direction = value >= 0 ? "+" : "";
    return `${direction}${value.toFixed(2)} %`;
  },
  formatDate: (date) => new Date(date).toISOString().split("T")[0],
  getToday: () => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Increment day by 1
    return today.toISOString().split("T")[0];
  },
  getStartOfTime: () => new Date(1900, 0, 2).toISOString().split("T")[0],
  // Generate UUID identifier
  generateUUID: () =>  crypto.randomUUID()
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
    appState.accountsTable["liq"].clear();
    appState.accountsTable["deb"].clear();
    let totalCash = 0;
    let totalDebt = 0;
    Object.values(appState.accounts).forEach((account) => {
      if ("total" in account && account.total.toFixed(2) != 0) {
        let type = "";
        if (
          account.asset_type &&
          account.asset_type in appState.accountTypesFormat
        )
          type = appState.accountTypesFormat[account.asset_type].name;
        let row = {
          name: account.name,
          balance: Utils.formatCurrency(account.total),
          type: type,
        };

        if (
          type == "" ||
          ["liq", "deps", "depl", "cred", "inv"].includes(account.asset_type)
        ) {
          totalCash += account.total;
          appState.accountsTable["liq"].row.add(row);
        }

        if (["deb", "debc"].includes(account.asset_type)) {
          totalDebt += account.total;
          appState.accountsTable["deb"].row.add(row);
        }
      }
    });

    $("#totalCash").html(Utils.formatCurrency(totalCash));
    $("#totalDebt").html(Utils.formatCurrency(totalDebt));
    appState.accountsTable["liq"].draw();
    appState.accountsTable["deb"].draw();
  }
}

class StockManager {
  static async fetchStockAssets() {
    try {
      const today = Utils.getToday();
      const stockAssets = await appState.apiClient.aggregateTransactions(
        today,
        today,
        "ticker",
        true,
      );

      const investments = await appState.apiClient.listInvestments(
        Utils.getStartOfTime(),
        Utils.getToday(),
      );

      investments.forEach((investment) => {
        if (!(investment.account in appState.brokers))
          appState.brokers[investment.account] = {
            account: investment.account,
            tickers: [],
            liquidity: appState.accounts[investment.account].total,
          };

        appState.brokers[investment.account].tickers.push({
          ticker: investment.ticker,
          quantity: investment.quantity,
        });
      });
      stockAssets.forEach((stock) => {
        appState.stocks[stock._id] = stock;

        appState.apiClient.getTickerPrice(stock._id).then((data) => {
          const stockData = appState.stocks[stock._id];
          stockData.price = data.price;
          stockData.current_value = data.price * stockData.quantity;
          stockData.daily_yield = data.daily_yield;
          UIManager.refresh();
        });
      });

      UIManager.refresh();
    } catch (error) {
      console.error("Error fetching stock assets:", error);
    }
  }

  static updateBrokersTable() {
    if (!appState.brokersTable) return;
    appState.brokersTable.clear();
    Object.values(appState.brokers).forEach((broker) => {
      let broker_value = 0;
      broker.tickers.forEach((stock) => {
        let stockData = appState.stocks[stock.ticker];
        broker_value += stockData.price * stock.quantity;
      });

      appState.brokersTable.row.add([
        appState.accounts[broker.account].name,
        Utils.formatCurrency(broker_value || 0),
        Utils.formatCurrency(broker.liquidity || 0),
        broker.liquidity > (broker_value * 2) / 1000 ? "OK" : "Poca liquiditá ",
      ]);
    });
    appState.brokersTable.draw();
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
      const price = stock.price
        ? `${Utils.formatCurrency(stock.price)} (${Utils.formatYield(stock.daily_yield)})`
        : null;
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

    $("#currentTotal").html(Utils.formatCurrency(total));
    if (totalInvested)
      $("#totalInv").html(
        `(+${(100 * (total / totalInvested - 1)).toFixed(2)}%)`,
      );
    appState.stocksTable.draw();
  }

  static updateStocksTableWeighted() {
    if (!appState.weightedStocksTable) return;
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

    appState.weightedStocksTable.draw();
  }
}

class NetManager {
  static async fetchNetCash() {
    try {
      const cashNet = await appState.apiClient.aggregateTransactions(
        Utils.getStartOfTime(),
        Utils.getToday(),
        "account",
      );

      const categories = await appState.apiClient.aggregateTransactions(
        Utils.getStartOfTime(),
        Utils.getToday(),
        "category",
      );

      categories.forEach((category) => {
        appState.categories[category["_id"]] = { name: category["_id"] };
      });

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
      0,
    );

    const totalStocks = Object.values(appState.stocks).reduce(
      (sum, stock) => sum + (stock.current_value || 0),
      0,
    );

    const totalNetWorth = totalNet + totalStocks;

    $("#total-net-worth").html(`${Utils.formatCurrency(totalNetWorth)}`);
  }
}

class UIManager {
  static menuItems = [
    { href: "./", label: "Home", icon: "bi-house" },
    { href: "./new.html", label: "Nuovo movimento", icon: "bi-journal-plus" },
    { href: "./transactions.html", label: "Tutti i movimenti", icon: "bi-list-columns" },
    { href: "./expenses.html", label: "Dettaglio spese", icon: "bi-cash-stack" },
    { href: "./accounts.html", label: "Conti", icon: "bi-bank" },
    { href: "./year.html", label: "Vista anno", icon: "bi-calendar" },
    { href: "./inv.html", label: "Investimenti", icon: "bi-graph-up" },
    { href: "./planning.html", label: "Pianificazione", icon: "bi-calendar-event" },

  ];

  static refresh() {
    AccountManager.updateAccountTable();
    StockManager.updateStocksTable();
    NetManager.updateTotalNetWorth();
    StockManager.updateStocksTableWeighted();
    StockManager.updateBrokersTable();
  }

  static populateDropdown(selector, items, defaultOption) {
    const dropdown = $(selector);
    dropdown.empty();
    dropdown.append(
      `<option value="" disabled selected>${defaultOption}</option>`,
    );
    for (let item in items) {
      dropdown.append(`<option value="${item}">${items[item].name}</option>`);
    }
  }

  static generateMenu() {
    const currentPage = window.location.pathname.split("/").pop();
    this.menuItems.forEach((item) => {
      const menuItem = $(
        `<a href="${item.href}" class="btn btn-light show-after-login flex-fill"><i class="bi ${item.icon}"></i> ${item.label}</a>`,
      );
      if (item.href.split("/").pop() === currentPage) {
        menuItem.removeClass("btn-light").addClass("btn-primary");
      }
      $("#menu").append(menuItem);
    });
  }
}

async function onLoginSuccess() {
  try {
    const user = await appState.apiClient.getMe();
    // Redirect to the page that triggered the login
    const redirect = localStorage.getItem("redirect");
    if (redirect) {
      localStorage.removeItem("redirect");
      window.location.replace(redirect);
    }
    $(".hide-after-login").hide();

    $("#login-feedback").html(
      `<div class="alert alert-primary lead">Ciao, <b>${user.username}</b> <button id="toggle-eye" class="btn"><i class="bi bi-eye-slash"></i></button><div >Patrimonio attuale: <span class="blur-this blur" id="total-net-worth"></span></div></div>`,
    );

    $("#toggle-eye").click(() => {	
      $(".blur-this").toggleClass("blur");	
      $("#toggle-eye i").toggleClass("bi-eye-slash");	
      $("#toggle-eye i").toggleClass("bi-eye");	

    });

    await AccountManager.refreshAccounts();
    UIManager.generateMenu();

    $(".show-after-login").show();
  } catch (error) {
    console.error("Error during login success process:", error);
    $("#login-feedback").html(
      `<div class="alert alert-danger">Login failed. Please try again.</div>`,
    );
    redirectToLogin();
  }
}

function redirectToLogin() {
  const currentUrl = window.location.href;
  if (!currentUrl.endsWith(".html")) return;
  const newUrl = currentUrl.replace(/\/[^/]+\.html$/, "/");
  localStorage.setItem("redirect", currentUrl);
  window.location.replace(newUrl);
}

function getBaseUrl() {
  const currentUrl = window.location.href;
  const appIndex = currentUrl.indexOf("/app/");

  // If "/app/" exists in the URL, strip everything after it
  if (appIndex !== -1) {
    return currentUrl.substring(0, appIndex); // Include the trailing slash
  }

  // Fallback: return the root if "/app/" is not found
  return "/";
}

async function boot() {
  $(".show-after-login").hide();
  const host = getBaseUrl();
  appState.apiClient = new ApiClient(`${host}`);
  if (appState.apiClient.isLogged()) {
    try {
      const me = await appState.apiClient.getMe();
      await onLoginSuccess();
    } catch (error) {
      appState.apiClient.accessToken = null;
      window.localStorage.removeItem("token");
      redirectToLogin();
    }
  } else {
    redirectToLogin();
  }
}
