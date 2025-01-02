$(document).ready(async function () {
  await boot();

  function initializeYearSelector() {
    const currentYear = new Date().getFullYear();
    const yearSelector = $("#yearSelector");

    // Populate options for the last 3 years up to the current year
    for (let year = currentYear - 3; year <= currentYear; year++) {
      const selected = year === currentYear ? "selected" : "";
      yearSelector.append(
        `<option value="${year}" ${selected}>${year}</option>`,
      );
    }
  }

  function drawTable(balances, totals, quotes) {
    // Populate table
    const table = $("#balancesTable").DataTable();
    table.clear(); // Clear existing rows

    // Add the total row at the beginning
    const totalRowData = [
      "Totale",
      ...totals.map((total) => `${total.toFixed(2)} €`),
    ];
    
    const yields = totals
      .slice(1)
      .map((current, i) =>
        totals[i] !== 0 ? ((current - totals[0]) / totals[0]) * 100 : 0,
      );
    
    const yieldRowData = [
      "Yield",
      "-",
      ...yields.map((yield) => `${yield.toFixed(2)} %`),
    ];
    const totalRowNode = table.row.add(totalRowData).node();
    $(totalRowNode).addClass("table-primary").css("font-weight", "bold");

    const yieldRowNode = table.row.add(yieldRowData).node();
    $(yieldRowNode).addClass("table-success").css("font-weight", "bold");

    Object.entries(balances).forEach(([account, months]) => {
      if (!appState.accounts[account]) return;
      const rowData = [
        appState.accounts[account].name,
        ...months.map((amount) => `${amount.toFixed(2)} €`),
      ];
      table.row.add(rowData); // Add new rows
    });

    table.draw(); // Redraw the table
  }

  function aggregateInvestments(monthlyInvestments, quotes, month, tickers) {
    if (month > 1) {
      // Copy all tickers from previous month
      for (a in quotes)
        quotes[a][month - 1] = JSON.parse(JSON.stringify(quotes[a][month - 2]));
    }
    monthlyInvestments.forEach(({ account, quantity, ticker }) => {
      tickers.add(ticker);
      if (!quotes[account]) {
        quotes[account] = Array(12);
        for (let m = 1; m <= 12; m++) quotes[account][m - 1] = new Object();
      }

      if (month > 1) {
        // Others
        if (!quotes[account][month - 2][ticker])
          quotes[account][month - 1][ticker] = quantity;
        else
          quotes[account][month - 1][ticker] =
            quotes[account][month - 2][ticker] + quantity;
      } else {
        // January
        if (!quotes[account][month - 1][ticker])
          quotes[account][month - 1][ticker] = quantity;
        else quotes[account][month - 1][ticker] += quantity;
      }
    });
  }

  async function loadBalancesForYear(year, backtrack = true) {
    if(appState.balances && year in appState.balances) return;
    let balances = {};
    let quotes = {};
    let tickers = new Set();
    if(appState.balances && backtrack) {
      quotes = JSON.parse(JSON.stringify(appState.balances[year-1].quotes));
      tickers = appState.balances[year-1].tickers;
    }

    let totals = Array(12).fill(0); // Initialize totals for each month
    
    for (let month = 1; month <= 12; month++) {
      const startDate = Utils.getStartOfTime();
      const startOfMonth = new Date(year, month - 1, 0)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];
      let monthlyData = await appState.apiClient.aggregateTransactions(
        startDate,
        endDate,
        "account",
      );
      let monthlyInvestments = await appState.apiClient.listInvestments(
        startOfMonth,
        endDate,
      );

      aggregateInvestments(monthlyInvestments, quotes, month, tickers);

      // Process data for all accounts in the result
      monthlyData.forEach(({ _id, total }) => {
        if (!balances[_id]) {
          balances[_id] = Array(12).fill(0); // Initialize array for 12 months
        }
        balances[_id][month - 1] = total || 0;
        totals[month - 1] += total || 0; // Accumulate totals for each month
      });
    }

    let totalInvested = {0:0.0}
    let investmentBalances = {}
    
    const tickerArr = Array.from(tickers);
    let cachedPrices = undefined;
    if (tickerArr.length > 0)
      cachedPrices = await appState.apiClient.getTickerPrice(
        tickerArr.join(","),
        year,
      );

    for (a in quotes) {
      let account = quotes[a];
      for (m in account) {
        let month = account[m];
        let monthTotal = 0;
        if(!(m in totalInvested)) totalInvested[m] = 0
        for (ticker in month) {
          if(!(m in cachedPrices)) {
            monthTotal = balances[a][m-1];
            continue;
          };
          let price = cachedPrices[m][tickerArr.indexOf(ticker)];
          monthTotal += price * month[ticker];
        }
        if (!balances[a]) balances[a] = Array(12).fill(0);
        if(!investmentBalances[a]) investmentBalances[a] = Array(12).fill(0);
        balances[a][m] = monthTotal;
        investmentBalances[a][m] = monthTotal;
        totals[m] += monthTotal;
        totalInvested[m] += monthTotal
      }
    }

    // Prepare a new object containing balances, totals, quotes, totalInvested
    // use year as key
    appState.balances = appState.balances || {};
    appState.balances[year] = { balances, totals, quotes, totalInvested, investmentBalances, tickers};

  }

  function plotAmounts(amounts, selector, caption) {
    let serie = [];
    for (let point in amounts) {
      let dataPoint = [parseInt(point) + 1, amounts[point].toFixed(2)];
      serie.push(dataPoint);
    }

    // Abbreviated month names
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const options = {
      xaxis: {
        ticks: serie.map(([x, _]) => [x, monthNames[x - 1]]), // Map x-values to abbreviated month names
      },
      yaxis: {
        tickFormatter: (val) => `${val.toFixed(0)} €`, // Add € symbol to y-axis
      },
      series: {
        lines: {
          show: true,
          lineWidth: 3, // Thicker line
        },
        points: {
          show: true, // Show points on the graph
          radius: 5, // Customize point size
        },
      },
      grid: {
        hoverable: true, // Enable hover for tooltips
      },
      legend: {
        show: true,
        position: "nw", // Legend position
        backgroundOpacity: 0.9,
        noColumns: 1,
      },
    };

    // Render the plot
    $.plot(
      selector,
      [
        {
          data: serie,
          label: caption,
        },
      ],
      options,
    );

    // Add hover tooltips
    $("<div id='tooltip'></div>")
      .css({
        position: "absolute",
        display: "none",
        border: "1px solid #ccc",
        padding: "5px",
        backgroundColor: "#fff",
        opacity: 0.9,
      })
      .appendTo("body");

    $(selector).bind("plothover", function (event, pos, item) {
      if (item) {
        const x = monthNames[item.datapoint[0] - 1]; // Get the abbreviated month name
        const y = item.datapoint[1].toFixed(2); // Format the y-value
        $("#tooltip")
          .html(`Month: ${x}<br>Balance: ${y} €`)
          .css({ top: item.pageY + 10, left: item.pageX + 10 })
          .fadeIn(200);
      } else {
        $("#tooltip").hide();
      }
    });
  }

  // Event listener for "Carica" button
  $("#loadBalances").on("click", async function () {
    const year = $("#yearSelector").val();
    if (!year) {
      return;
    }
    await doLoad(year);
  });

  async function doLoad(year = new Date().getFullYear()) {
    $(".loading").show();
    $(".loaded").hide();
    $("#loadBalances").attr("disabled", "disabled");
    await loadBalancesForYear(year-1, false);
    await loadBalancesForYear(year);
    render(year);
    $(".loading").hide();
    $(".loaded").show();
    $("#loadBalances").removeAttr("disabled");
  }


  function render(year) {
    // Populate table
    drawTable(appState.balances[year].balances, appState.balances[year].totals, appState.balances[year].quotes);
    // Plot totals
    plotAmounts(appState.balances[year].totals, '#total-holder', `${year}: Patrimonio nel tempo`);
    plotAmounts(appState.balances[year].totalInvested, '#inv-holder', `${year}: Investimenti nel tempo`)
  }

  // Initialize the page
  initializeYearSelector();
  // Initialize DataTable
  $("#balancesTable").DataTable({
    paging: false,
    searching: false,
    info: false,
    autoWidth: false,
    ordering: false,
    columns: [
      { title: "Account" },
      ...[
        "Gennaio",
        "Febbraio",
        "Marzo",
        "Aprile",
        "Maggio",
        "Giugno",
        "Luglio",
        "Agosto",
        "Settembre",
        "Ottobre",
        "Novembre",
        "Dicembre",
      ].map((month) => ({ title: month, className: "text-right" })),
    ],
  });

  const currentYear = new Date().getFullYear();
  doLoad(currentYear);
});
