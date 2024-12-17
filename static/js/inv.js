function updateAmountInv() {
    price = $("#investment-price").val()
    quantity = $("#investment-quantity").val()
    fee = parseFloat($("#investment-fee").val())
    if(isNaN(fee)) fee = 0
    total = price*quantity + fee
    $("#investment-amount").val(total)
}        

function updatePrice() {
    console.log("called")
    appState.apiClient.getTickerPrice($("#investment-ticker").val()).then(response => {
        $("#investment-price").val(response.price.toFixed(2))
    })
}

$(document).ready(async function () {
    await boot()

    const simpleTable = {
        "bPaginate": false,
        "bLengthChange": false,
        "bFilter": false,
        "bInfo": false,
        "bAutoWidth": false,
       
    }
    
    appState.weightedStocksTable = $("#stocks-table").DataTable({...simpleTable,  order: [[3, 'desc']]});
    appState.brokersTable = $("#brokers-table").DataTable({...simpleTable,  order: [[1, 'desc']]});

    $("#investment-plan").on("submit", async function (e) {
        e.preventDefault()
        let ticker = $("#investment-ticker").val();
        let quantity = $("#investment-quantity").val();
        let amount = $("#investment-amount").val();
        let price = $("#investment-price").val();
        let current_value = price*quantity;

        if(ticker in appState.stocks) {
            appState.stocks[ticker].quantity+=parseInt(quantity)
            appState.stocks[ticker].amount+=amount
            appState.stocks[ticker].current_value+=current_value
        } else {
            stockData = {
                _id: ticker,
                quantity: parseInt(quantity),
                current_value: current_value,
                price: price,
                amount: amount
            }
            appState.stocks[ticker] = stockData
        }
        UIManager.refresh()
    });



});