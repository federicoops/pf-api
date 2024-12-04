async function onLoginSuccess() {
    $(".hide-after-login").hide();
    const me = await $.apiClient.getMe()
    $("#login-feedback").html(`<div class="alert alert-success">Welcome <b>${me.username}</b></div>`);

    const accounts = await $.apiClient.listAccounts()
    accounts.forEach(account => {
        $.accounts[account._id] =  account
    })

    fetchNetCash()
    fetchStockAssets()
    $(".show-after-login").show()
}


async function fetchNetCash() {
    today = new Date();
    today.setDate(today.getDate()+1)
    const startOfTime = new Date(1900, 0, 2);
    startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setDate(startOfMonth.getDate()+1)
    const todayFormatted = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    $('#tr-end').val(todayFormatted);

    // Get the start of the current month
    const startOfMonthFormatted = startOfMonth.toISOString().split('T')[0];

    $('#tr-start').val(startOfMonthFormatted);
    const cashNet = await $.apiClient.aggregateTransactions(startOfTime.toISOString().split('T')[0], todayFormatted, 'account')
    cashNet.forEach(accountNet => {
        if(accountNet._id in $.accounts) {
            const account = $.accounts[accountNet._id]
            $("#account-list").append(`<li>${account.name}: ${accountNet.total.toFixed(2)} €</li>`)
        }
    })
}

async function fetchStockAssets() {
    const today = new Date();
    const formatted = today.toISOString().split('T')[0];
    const stockAssets = await $.apiClient.aggregateTransactions(formatted, formatted, 'ticker')
    stockAssets.forEach(stock => {
        $.stocks[stock._id] = stock
        stock_id = stock._id.replace(".","")
        $("#stocks-list").append(`<li id="${stock_id}">${stock._id}: ${stock.quantity}, ${stock.total_wfee}  €`)
        $.apiClient.getTickerPrice(stock._id).then(data => {
            data.price = data.price.toFixed(1)
            $.stocks[stock._id].price = data.price
            current_value = data.price*$.stocks[stock._id].quantity
            current_yield = (current_value/stock.total_wfee - 1)*100
            direction = (current_yield>=0)?"+":"-"
            $(`#${data.ticker.replace(".","")}`).append(`, <em>${data.price}  €</em><b> ${current_value.toFixed(2)} € (${direction}${current_yield.toFixed(2)}%)</b>`)
        })
    })
}


async function onTransactionFetched(transactions) {
    // Clear existing data in DataTable
    $.transactionsTable.clear();

    // Populate table
    transactions.forEach(transaction => {
        $.transactions[transaction._id] = transaction
        const account = $.accounts[transaction.account]
        const date = new Date(transaction.date)
        $.transactionsTable.row.add([
            `${transaction.amount} €`,
            date.toISOString().split('T')[0],
            transaction.category,
            account.name,                    
            transaction.description || "N/A",
        ]);
    });

    // Redraw the table
    $.transactionsTable.draw();    
}