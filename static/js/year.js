$(document).ready(async function () {
    await boot();

    function initializeYearSelector() {
        const currentYear = new Date().getFullYear();
        const yearSelector = $("#yearSelector");

        // Populate options for the last 3 years up to the current year
        for (let year = currentYear - 3; year <= currentYear; year++) {
            const selected = year === currentYear ? 'selected' : '';
            yearSelector.append(`<option value="${year}" ${selected}>${year}</option>`);
        }
    }


    function drawTable(balances, totals, quotes) {
        // Populate table
        const table = $("#balancesTable").DataTable();
        table.clear(); // Clear existing rows

        // Add the total row at the beginning
        const totalRowData = ["Totale", ...totals.map(total => `${total.toFixed(2)} €`)];
        const yields = totals.slice(1).map((current, i) => 
            totals[i] !== 0 ? ((current - totals[0]) / totals[0]) * 100 : null
        );
        const yieldRowData = ["Yield", "-",...yields.map(yield => `${yield.toFixed(2)} %`)];
        const totalRowNode = table.row.add(totalRowData).node();
        $(totalRowNode).addClass("table-primary").css("font-weight", "bold");

        const yieldRowNode = table.row.add(yieldRowData).node();
        $(yieldRowNode).addClass("table-success").css("font-weight", "bold");

        Object.entries(balances).forEach(([account, months]) => {
            if (!$.accounts[account]) return;
            const rowData = [$.accounts[account].name, ...months.map(amount => `${amount.toFixed(2)} €`)];
            table.row.add(rowData); // Add new rows
        });

        table.draw(); // Redraw the table
    }

    function aggregateInvestments(monthlyInvestments, quotes, month, tickers) {
        if(month > 1) {
                // Copy all tickers from previous month
                for(a in quotes)  quotes[a][month - 1] = JSON.parse(JSON.stringify(quotes[a][month - 2]))
        }
        monthlyInvestments.forEach(({ account, quantity, ticker }) => {
            tickers.add(ticker)
            if(!quotes[account]) {
                quotes[account] = Array(12)
                for (let m = 1; m <= 12; m++) quotes[account][m-1] = new Object()
            }

            if(month > 1) { // Others
                if(!quotes[account][month - 2][ticker]) quotes[account][month - 1][ticker] = quantity;
                else quotes[account][month - 1][ticker] = quotes[account][month - 2][ticker] + quantity
            } else { // January
                if(!quotes[account][month - 1][ticker]) quotes[account][month - 1][ticker] = quantity;
                else quotes[account][month - 1][ticker] += quantity;
            }
        });
    }

    async function loadBalancesForYear(year) {
        let balances = {};
        let quotes = {}
        let totals = Array(12).fill(0); // Initialize totals for each month
        let tickers = new Set()
        for (let month = 1; month <= 12; month++) {
            const startDate = getStartOfTime();
            const startOfMonth = new Date(year, month-1, 0).toISOString().split('T')[0];
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            let monthlyData = await $.apiClient.aggregateTransactions(startDate, endDate, "account");
            let monthlyInvestments = await $.apiClient.listInvestments(startOfMonth, endDate)

            aggregateInvestments(monthlyInvestments, quotes, month, tickers)

            // Process data for all accounts in the result
            monthlyData.forEach(({ _id, total }) => {
                if (!balances[_id]) {
                    balances[_id] = Array(12).fill(0); // Initialize array for 12 months
                }
                balances[_id][month - 1] = total || 0;
                totals[month - 1] += total || 0; // Accumulate totals for each month

            });

        }

        const tickerArr = Array.from(tickers)
        let cachedPrices = undefined;
        if(tickerArr.length > 0) cachedPrices = await $.apiClient.getTickerPrice(tickerArr.join(','), year)

        for(a in quotes) {
            let account = quotes[a]
            for(m in account) {
                let month = account[m];
                let monthTotal = 0
                for(ticker in month) {
                    let price = cachedPrices[m][tickerArr.indexOf(ticker)]
                    monthTotal+= price * month[ticker]
                }
                if(!balances[a]) balances[a] = Array(12).fill(0); 
                balances[a][m] = monthTotal
                totals[m] += monthTotal
            }
        }
        // Populate table
        drawTable(balances, totals, quotes)
    }



    // Event listener for "Carica" button
    $("#loadBalances").on("click", async function () {
        const year = $("#yearSelector").val();
        if (!year) {
            return;
        }
       doLoad(year)
    });


    async function doLoad(year = new Date().getFullYear()) {
        $(".loading").show()
        $(".loaded").hide()
        $("#loadBalances").attr('disabled','disabled');
        await loadBalancesForYear(year);
        $(".loading").hide()
        $(".loaded").show()
        $("#loadBalances").removeAttr('disabled');
    }

    // Initialize the page
    initializeYearSelector();

    // Initialize DataTable
    $("#balancesTable").DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false,
        columns: [
            { title: "Account" },
            ...["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
                "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
                .map(month => ({ title: month, className: "text-right" }))
        ],
    });

    const currentYear = new Date().getFullYear();
    doLoad(currentYear)

});
